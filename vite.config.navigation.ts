import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(dirname, 'client/navigation.ts'),
      formats: ['es'],
      fileName: () => 'giorgia-navigation.js'
    },
    outDir: resolve(dirname, 'dist/assets'),
    rollupOptions: {
      output: {
        assetFileNames: 'giorgia-navigation[extname]'
      }
    }
  }
});
