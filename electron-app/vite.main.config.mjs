// vite.main.config.mjs
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/main.js'),
      formats: ['cjs'],
    },
    outDir: path.resolve(__dirname, '.vite/build'),
    emptyOutDir: false,  // keep preload & renderer outputs
    rollupOptions: {
      output: { entryFileNames: 'main.js' },
    },
  },
});
