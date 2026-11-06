import { cp, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import storybookConfig from '../.storybook/main.js';
import { main as prepareAssets } from '../scripts/prepare-storybook-assets.js';
import { main as verifyArtifact } from '../scripts/verify-storybook-artifact.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';


const root = path.resolve(import.meta.dirname, '..');
const staged = path.join(root, '.cache/storybook-public');
const temporary: string[] = [];

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
    // The staging script consumes dist/assets/giorgia-navigation.js, built by pretest:unit and test:coverage.
    await prepareAssets();
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
      const { viteFinal } = storybookConfig;
      if (!viteFinal) throw new Error('viteFinal is not configured');
      const resolved = await viteFinal({ base: '/' }, { configType: 'DEVELOPMENT' } as Parameters<typeof viteFinal>[1]);
      expect(resolved).toMatchObject({ base: '/', assetsInclude: ['**/*.hbs'] });
    });
  });

  describe('scripts/prepare-storybook-assets.ts', () => {
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
      await prepareAssets();
      expect(await exists(stale)).toBe(false);
      expect(await exists(path.join(root, 'src/styles/compiled.css'))).toBe(true);
    });
  });

  describe('scripts/verify-storybook-artifact.ts', () => {
    it('fails when the artifact lacks the packaged font stylesheet', async () => {
      const directory = await artifactCopy();
      await rm(path.join(directory, 'content/fonts/fonts.css'));
      await expect(verifyArtifact(directory, path.join(directory, 'evidence'))).rejects.toThrow(/ENOENT/);
    });

    it('fails when a font referenced by fonts.css is not served', async () => {
      const directory = await artifactCopy();
      await rm(path.join(directory, 'content/fonts/barlow-latin-400-normal.woff2'));
      await expect(verifyArtifact(directory, path.join(directory, 'evidence'))).rejects.toThrow(/barlow-latin-400-normal\.woff2/);
    });

    it('fails when a served asset differs from its producer', async () => {
      const directory = await artifactCopy();
      await writeFile(path.join(directory, 'content/fonts/fonts.css'), `${await readFile(path.join(root, 'src/styles/fonts.css'), 'utf8')}\n/* drift */`);
      await expect(verifyArtifact(directory, path.join(directory, 'evidence'))).rejects.toThrow(/differs from its existing producer/);
    });
  });
});
