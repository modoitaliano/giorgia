import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'vite';
import { beforeAll, describe, expect, it } from 'vitest';

import { listDirectoryFiles, type ManifestFileEntry } from './live-program-manifest.js';

// giorgia#48: the live-program bundle carries the clock plate and none of the retired ModoRadio marks.
const OUT_DIR = resolve('dist', 'live-program-page');
const CLOCK_PLATE_KEY = 'modoitaliano/tv/reloj.png';
const CLOCK_PLATE_SHA256 = '3b62d40eee4973c34932b86bf1eb023587ca4fed4b8b7cc682f7ac1a5ce04823';
const RETIRED_MARKS = ['bug-sm.svg', 'bug-big.svg', 'reloj-modoradio_full_negro.svg'];

let files: string[] = [];

describe('built live-program bundle', () => {
  beforeAll(async () => {
    // Build with the real config so the assertions run on real output.
    await build({ configFile: resolve('vite.config.live-program.ts'), logLevel: 'silent' });
    files = listDirectoryFiles(OUT_DIR);
  }, 180_000);

  it('contains none of the retired ModoRadio files and no reference to their names', () => {
    expect(files.length).toBeGreaterThan(0);
    for (const name of RETIRED_MARKS) {
      expect(files.filter((key) => key.endsWith(name))).toEqual([]);
    }
    const referencing = files.filter((key) => {
      const text = readFileSync(join(OUT_DIR, key), 'latin1');
      return RETIRED_MARKS.some((name) => text.includes(name));
    });
    expect(referencing).toEqual([]);
  });

  it('ships reloj.png byte-identical and refers to it bundle-relative', () => {
    expect(files).toContain(CLOCK_PLATE_KEY);
    const sha256 = createHash('sha256').update(readFileSync(join(OUT_DIR, CLOCK_PLATE_KEY))).digest('hex');
    expect(sha256).toBe(CLOCK_PLATE_SHA256);
    const script = readFileSync(join(OUT_DIR, 'live-program.js'), 'utf8');
    expect(script).toContain(`./${CLOCK_PLATE_KEY}`);
    expect(script).not.toMatch(new RegExp(`['"(\`]/reloj\\.png`));
    expect(readFileSync(join(OUT_DIR, 'live-program.css'), 'utf8')).not.toContain('reloj.png');
  });

  it('lists reloj.png in the emitted manifest with its sha256', () => {
    const manifest = JSON.parse(readFileSync(join(OUT_DIR, 'live-program-manifest.json'), 'utf8')) as {
      files: ManifestFileEntry[];
    };
    expect(manifest.files.find((entry) => entry.key === CLOCK_PLATE_KEY)).toEqual({
      key: CLOCK_PLATE_KEY,
      bytes: 8232,
      contentType: 'image/png',
      sha256: CLOCK_PLATE_SHA256,
    });
    expect(manifest.files.filter((entry) => RETIRED_MARKS.some((name) => entry.key.endsWith(name)))).toEqual([]);
  });

  // giorgia#53: the page never requests a site-absolute asset the bundle does not contain (it used to fall back to
  // /cover.jpg, which only Alcantara's own site serves). Every quoted or url() path that starts with one slash and
  // ends in an asset extension must be a file of the bundle.
  it('references no site-absolute asset path that the bundle does not contain', () => {
    const missing = unbundledAbsoluteAssetPaths(OUT_DIR, files);
    expect(missing).toEqual([]);
  });
});

const ASSET_EXTENSIONS = 'jpe?g|png|gif|webp|avif|svg|ico|mp3|ogg|wav|m4a|mp4|webm|woff2?|ttf|otf|json';
const ABSOLUTE_ASSET_PATH = new RegExp(`(?:["'\`(]|url\\(\\s*["']?)(/(?!/)[^"'\`()\\s?#]+\\.(?:${ASSET_EXTENSIONS}))(?=[?#"'\`)\\s])`, 'gi');

/** Site-absolute asset paths referenced by the bundle's scripts, styles and pages that are not files of the bundle. */
function unbundledAbsoluteAssetPaths(outDir: string, bundleFiles: string[]): string[] {
  const contained = new Set(bundleFiles);
  const missing = new Set<string>();
  for (const key of bundleFiles.filter((file) => /\.(?:m?js|css|html)$/.test(file))) {
    const text = readFileSync(join(outDir, key), 'utf8');
    for (const match of text.matchAll(ABSOLUTE_ASSET_PATH)) {
      const path = match[1]!;
      if (!contained.has(path.slice(1))) missing.add(path);
    }
  }
  return [...missing].sort();
}

