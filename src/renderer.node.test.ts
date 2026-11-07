import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { assetFiles, fontFiles, liveProgramPageAsset, liveProgramPageFiles, liveProgramPageHtml } from './renderer.node.js';

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const pageDir = path.join(srcDir, 'live-program-page');
const fontsPath = path.join(srcDir, 'fonts');
const assetsPath = path.join(srcDir, 'assets');

interface Tree {
  [name: string]: string | Tree;
}

function dirent(name: string, isDir: boolean) {
  return { name, isDirectory: () => isDir, isFile: () => !isDir } as unknown as fs.Dirent;
}

function mockTree(root: string, tree: Tree) {
  const lookup = (target: string): string | Tree | undefined => {
    const rel = path.relative(root, target);
    if (rel.startsWith('..')) return undefined;
    return rel === '' ? tree : rel.split(path.sep).reduce<string | Tree | undefined>((node, part) => (typeof node === 'object' ? node[part] : undefined), tree);
  };
  vi.spyOn(fs, 'existsSync').mockImplementation((target) => lookup(String(target)) !== undefined);
  vi.spyOn(fs, 'readdirSync').mockImplementation(((target: fs.PathLike) => {
    const node = lookup(String(target)) as Tree;
    return Object.entries(node).map(([name, value]) => dirent(name, typeof value === 'object'));
  }) as never);
  vi.spyOn(fs, 'readFileSync').mockImplementation(((target: fs.PathLike, encoding?: unknown) => {
    const node = lookup(String(target)) as string;
    return encoding ? node : Buffer.from(node);
  }) as never);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('live program page accessors', () => {
  it('reads the page html and assets when the build output exists', () => {
    mockTree(pageDir, { 'index.html': '<html/>', 'app.js': 'x' });
    expect(liveProgramPageHtml()).toBe('<html/>');
    expect(liveProgramPageAsset('app.js')).toBe('x');
  });

  it('fails with a build hint when the page or an asset is missing', () => {
    mockTree(pageDir, {});
    expect(() => liveProgramPageHtml()).toThrow(/live-program-page\/index\.html not found .* build:live-program/);
    expect(() => liveProgramPageAsset('app.js')).toThrow(/live-program-page\/app\.js not found/);
    expect(() => liveProgramPageFiles()).not.toThrow();
  });

  it('fails when the page directory is absent', () => {
    mockTree(path.join(srcDir, 'elsewhere'), {});
    expect(() => liveProgramPageFiles()).toThrow(/live-program-page directory not found/);
  });

  it('walks nested files with content types', () => {
    mockTree(pageDir, { 'index.html': 'h', assets: { 'a.JS': 'j', 'b.css': 'c', 'c.bin': 'z' } });
    expect(liveProgramPageFiles()).toEqual([
      { key: 'index.html', body: Buffer.from('h'), contentType: 'text/html; charset=utf-8' },
      { key: 'assets/a.JS', body: Buffer.from('j'), contentType: 'application/javascript' },
      { key: 'assets/b.css', body: Buffer.from('c'), contentType: 'text/css' },
      { key: 'assets/c.bin', body: Buffer.from('z'), contentType: 'application/octet-stream' },
    ]);
  });

  it('ignores entries that are neither files nor directories', () => {
    mockTree(pageDir, { 'index.html': 'h' });
    vi.spyOn(fs, 'readdirSync').mockReturnValue([{ name: 'odd', isDirectory: () => false, isFile: () => false }] as never);
    expect(liveProgramPageFiles()).toEqual([]);
  });
});

describe('font and asset accessors', () => {
  it('lists fonts with content types and appends fonts.css last', () => {
    mockTree(fontsPath, { 'a.woff2': '1', 'fonts.css': 'css', dir: {}, 'b.woff': '2' });
    vi.spyOn(fs, 'readdirSync').mockReturnValue([dirent('a.woff2', false), dirent('fonts.css', false), dirent('dir', true), dirent('b.woff', false)] as never);
    expect(fontFiles().map((f) => [f.key, f.contentType])).toEqual([
      ['content/fonts/a.woff2', 'font/woff2'],
      ['content/fonts/b.woff', 'font/woff'],
      ['content/fonts/fonts.css', 'text/css'],
    ]);
  });

  it('omits fonts.css when it is absent and fails when the directory is absent', () => {
    mockTree(fontsPath, { 'a.woff2': '1' });
    expect(fontFiles().map((f) => f.key)).toEqual(['content/fonts/a.woff2']);
    mockTree(path.join(srcDir, 'elsewhere'), {});
    expect(() => fontFiles()).toThrow(/fonts directory not found/);
  });

  it('lists only files in the assets directory and fails when it is absent', () => {
    mockTree(assetsPath, { 'x.PNG': 'p', 'y.mp3': 'm', sub: {} });
    expect(assetFiles().map((f) => [f.key, f.contentType])).toEqual([
      ['assets/x.PNG', 'image/png'],
      ['assets/y.mp3', 'audio/mpeg'],
    ]);
    mockTree(path.join(srcDir, 'elsewhere'), {});
    expect(() => assetFiles()).toThrow(/assets directory not found/);
  });
});

describe('render asset loading from disk', () => {
  const projectRoot = path.resolve(srcDir, '..');
  const stylesPath = path.join(projectRoot, 'src', 'styles', 'compiled.css');
  const partialsPath = path.join(projectRoot, 'src', 'templates', 'partials');

  it('fails with a build hint when compiled.css is missing', async () => {
    vi.resetModules();
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const mod = await import('./renderer.node.js');
    expect(() => mod.render({ layout: 'homepage' } as never)).toThrow('compiled.css not found — run npm run build:css first');
  });

  it('fails when a declared layout file is missing', async () => {
    vi.resetModules();
    vi.spyOn(fs, 'existsSync').mockImplementation((target) => String(target) === stylesPath);
    const mod = await import('./renderer.node.js');
    expect(() => mod.render({ layout: 'homepage' } as never)).toThrow(/Layout template missing for ".+": /);
  });

  it('loads layouts and nested hbs partials, skipping other files, and caches the assets', async () => {
    vi.resetModules();
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const odd = { name: 'odd', isDirectory: () => false, isFile: () => false };
    vi.spyOn(fs, 'readdirSync').mockImplementation(((target: fs.PathLike) => {
      if (String(target) === partialsPath) return [dirent('nested', true), dirent('notes.txt', false), dirent('top.hbs', false), odd];
      return [dirent('inner.hbs', false)];
    }) as never);
    const read = vi.spyOn(fs, 'readFileSync').mockImplementation(((target: fs.PathLike) => `src:${path.basename(String(target))}`) as never);

    const mod = await import('./renderer.node.js');
    expect(() => mod.render({ layout: 'nope' } as never)).toThrow(/Unknown layout "nope"/);
    const { default: Handlebars } = await import('handlebars');
    expect(Handlebars.partials['top']).toBe('src:top.hbs');
    expect(Handlebars.partials['nested/inner']).toBe('src:inner.hbs');
    expect(Handlebars.partials['notes']).toBeUndefined();

    const reads = read.mock.calls.length;
    expect(() => mod.render({ layout: 'nope' } as never)).toThrow(/Unknown layout/);
    expect(read.mock.calls.length).toBe(reads);
  });
});
