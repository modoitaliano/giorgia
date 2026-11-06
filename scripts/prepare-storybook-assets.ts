import { cp, copyFile, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Only generated Storybook staging is reset; package assets remain untouched.
export async function main(): Promise<void> {
  const root = new URL('../', import.meta.url);
  const output = new URL('.cache/storybook-public/', root);
  await rm(output, { recursive: true, force: true });
  await mkdir(new URL('content/styles/', output), { recursive: true });
  await cp(new URL('src/templates/assets/', root), new URL('assets/', output), { recursive: true });
  await cp(new URL('src/styles/fonts/', root), new URL('content/fonts/', output), { recursive: true });
  await copyFile(new URL('src/styles/compiled.css', root), new URL('content/styles/giorgia.css', output));
  await copyFile(new URL('src/styles/fonts.css', root), new URL('content/fonts/fonts.css', output));
  await copyFile(new URL('dist/assets/giorgia-navigation.js', root), new URL('assets/giorgia-navigation.js', output));
  console.log(`Prepared Storybook page assets in ${fileURLToPath(output)}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await main();
