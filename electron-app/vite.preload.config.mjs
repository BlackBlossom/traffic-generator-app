// vite.preload.config.mjs
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/preload.js'),
      formats: ['cjs'],
    },
    outDir: path.resolve(__dirname, '.vite/build'),
    emptyOutDir: false,
    rollupOptions: {
      output: { entryFileNames: 'preload.js' },
    },
  },
});
