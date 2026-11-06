import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';


const root = path.resolve(import.meta.dirname, '..');
const staged = path.join(root, '.cache/storybook-public');
const navigation = path.join(root, 'dist/assets/giorgia-navigation.js');
const temporary: string[] = [];
let imports = 0;
// Loaded by path: .storybook sits outside the typecheck rootDir.
type StorybookConfigShape = {
  staticDirs: string[];
  stories: string[];
  framework: string;
  viteFinal(config: Record<string, unknown>): Promise<Record<string, unknown>>;
};
let storybookConfig: StorybookConfigShape;

async function runScript(script: string, argv: string[] = []) {
  const original = process.argv;
  process.argv = [original[0], script, ...argv];
  try {
    // A unique query re-evaluates the top-level script on every call.
    return await import(/* @vite-ignore */ `${pathToFileURL(path.join(root, script)).href}?run=${imports++}`);
  } finally {
    process.argv = original;
  }
}

async function artifactCopy() {
  const directory = await mkdtemp(path.join(tmpdir(), 'giorgia-artifact-'));
  temporary.push(directory);
  await cp(staged, directory, { recursive: true });
  return directory;
}

async function exists(file: string) {
  return stat(file).then(() => true, () => false);
}

describe('Storybook tooling', () => {
  beforeAll(async () => {
    storybookConfig = (await import(/* @vite-ignore */ pathToFileURL(path.join(root, '.storybook/main.ts')).href)).default;
    // The staging script consumes the navigation bundle produced by the package build.
    if (!(await exists(navigation))) execFileSync('npm', ['run', 'build:navigation'], { cwd: root, stdio: 'pipe' });
    await runScript('scripts/prepare-storybook-assets.mjs');
  }, 120_000);

  afterAll(async () => {
    await Promise.all(temporary.map(directory => rm(directory, { recursive: true, force: true })));
  });

  describe('.storybook/main.ts', () => {
    it('serves the staged page assets and the story globs', () => {
      expect(storybookConfig.staticDirs).toEqual(['../.cache/storybook-public']);
      expect(storybookConfig.stories).toContain('../stories/LiveStoryPage.stories.ts');
      expect(storybookConfig.framework).toBe('@storybook/html-vite');
    });

    it('lets Vite treat Handlebars templates as assets', async () => {
      const resolved = await storybookConfig.viteFinal({ base: '/' });
      expect(resolved).toMatchObject({ base: '/', assetsInclude: ['**/*.hbs'] });
    });
  });

  describe('scripts/prepare-storybook-assets.mjs', () => {
    it('stages packaged assets at the paths the page stories request', async () => {
      const pairs: Array<[string, string]> = [
        ['content/styles/giorgia.css', 'src/styles/compiled.css'],
        ['content/fonts/fonts.css', 'src/styles/fonts.css'],
        ['assets/giorgia-navigation.js', 'dist/assets/giorgia-navigation.js'],
        ['assets/mi.svg', 'src/templates/assets/mi.svg'],
        ['content/fonts/barlow-latin-400-normal.woff2', 'src/styles/fonts/barlow-latin-400-normal.woff2']
      ];
      for (const [target, source] of pairs) {
        expect(await readFile(path.join(staged, target))).toEqual(await readFile(path.join(root, source)));
      }
    });

    it('resets only the generated staging directory on every run', async () => {
      const stale = path.join(staged, 'stale.txt');
      await writeFile(stale, 'stale');
      await runScript('scripts/prepare-storybook-assets.mjs');
      expect(await exists(stale)).toBe(false);
      expect(await exists(path.join(root, 'src/styles/compiled.css'))).toBe(true);
    });
  });

  describe('scripts/verify-storybook-artifact.mjs', () => {
    it('fails when the artifact lacks the packaged font stylesheet', async () => {
      const directory = await artifactCopy();
      await rm(path.join(directory, 'content/fonts/fonts.css'));
      await expect(runScript('scripts/verify-storybook-artifact.mjs', [directory, path.join(directory, 'evidence')])).rejects.toThrow(/ENOENT/);
    });

    it('fails when a font referenced by fonts.css is not served', async () => {
      const directory = await artifactCopy();
      await rm(path.join(directory, 'content/fonts/barlow-latin-400-normal.woff2'));
      await expect(runScript('scripts/verify-storybook-artifact.mjs', [directory, path.join(directory, 'evidence')])).rejects.toThrow(/barlow-latin-400-normal\.woff2/);
    });

    it('fails when a served asset differs from its producer', async () => {
      const directory = await artifactCopy();
      await writeFile(path.join(directory, 'content/styles/giorgia.css'), 'body{}');
      await expect(runScript('scripts/verify-storybook-artifact.mjs', [directory, path.join(directory, 'evidence')])).rejects.toThrow(/differs from its existing producer/);
    }, 120_000); // assert.deepEqual renders a large buffer diff before throwing
  });
});
