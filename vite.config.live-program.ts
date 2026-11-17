import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectBundleFiles,
  createLiveProgramManifest,
  discoverLiveProgramComponents,
  LIVE_PROGRAM_COMPONENTS_DIR,
  validateLiveProgramManifest,
} from './src/live-program-manifest.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const outDir = resolve(__dirname, 'dist', 'live-program-page');
const packageJson = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'));
const packageVersion = packageJson.version as string;

export default defineConfig({
  base: './',
  publicDir: resolve(__dirname, 'src/live-program/public'),
  envDir: 'src/live-program',
  plugins: [
    tailwindcss(),
    react(),
    {
      name: 'flatten-html-and-emit-manifest',
      closeBundle() {
        const nested = join(outDir, 'src', 'live-program', 'index.html');
        const flat = join(outDir, 'index.html');
        if (existsSync(nested)) {
          let html = readFileSync(nested, 'utf-8');
          html = html.replace(/src="\.\.\/\.\.\//g, 'src="./');
          html = html.replace(/href="\.\.\/\.\.\//g, 'href="./');
          writeFileSync(flat, html);
          rmSync(join(outDir, 'src'), { recursive: true, force: true });
        }

        const files = collectBundleFiles(outDir);
        const components = discoverLiveProgramComponents(LIVE_PROGRAM_COMPONENTS_DIR, __dirname);
        if (components.length === 0) {
          throw new Error(`No live-program components found under ${LIVE_PROGRAM_COMPONENTS_DIR}`);
        }

        const manifest = createLiveProgramManifest({
          packageVersion,
          files,
          components,
        });

        const manifestPath = join(outDir, 'live-program-manifest.json');
        writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

        const schemaPath = resolve(__dirname, 'docs/contracts/program-template-v2.schema.json');
        const validation = validateLiveProgramManifest(manifest, schemaPath);
        if (!validation.valid) {
          throw new Error(
            `Live program manifest schema validation failed: ${validation.errors?.join('; ')}`
          );
        }
      },
    },
  ],
  build: {
    outDir,
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: resolve(__dirname, 'src/live-program/index.html'),
      output: {
        entryFileNames: 'live-program.js',
        assetFileNames: 'live-program[extname]',
      },
    },
  },
});
