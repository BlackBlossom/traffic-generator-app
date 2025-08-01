// vite.main.config.mjs
import { defineConfig } from 'vite';
import path from 'path';
import { copyFileSync, mkdirSync, readdirSync, statSync } from 'fs';

// Plugin to copy main directory to build output
function copyMainFolderPlugin() {
  return {
    name: 'copy-main-folder',
    writeBundle() {
      const srcMainDir = path.resolve(__dirname, 'src/main');
      const destMainDir = path.resolve(__dirname, 'dist/main');
      
      function copyDirectory(src, dest) {
        if (!statSync(src).isDirectory()) return;
        
        mkdirSync(dest, { recursive: true });
        
        const files = readdirSync(src);
        for (const file of files) {
          const srcPath = path.join(src, file);
          const destPath = path.join(dest, file);
          
          if (statSync(srcPath).isDirectory()) {
            copyDirectory(srcPath, destPath);
          } else {
            copyFileSync(srcPath, destPath);
          }
        }
      }
      
      copyDirectory(srcMainDir, destMainDir);
      console.log('✅ Copied main folder to build output');
    }
  };
}

export default defineConfig({
  plugins: [copyMainFolderPlugin()],
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/main.js'),
      formats: ['cjs'],
    },
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: false,  // keep preload & renderer outputs
    rollupOptions: {
      output: { 
        entryFileNames: 'main.js',
        format: 'cjs'
      },
      external: [
        'electron',
        'node:path',
        'node:url', 
        'node:fs',
        'node:os',
        'node:crypto',
        'node:stream',
        'node:util',
        'node:events',
        'electron-squirrel-startup',
        // Database and external dependencies
        'mongoose',
        'better-sqlite3',
        'puppeteer',
        'puppeteer-core',
        'puppeteer-extra',
        'puppeteer-extra-plugin-stealth',
        'user-agents',
        'uuid',
        'dotenv',
        'auto-launch',
        'node-cron',
        'bcryptjs',
        'axios',
        // Node.js built-in modules (without node: prefix for compatibility)
        'child_process',
        'fs',
        'path',
        'os',
        'crypto',
        'stream',
        'util',
        'events',
        'http',
        'https',
        'url'
      ]
    },
    target: 'node16', // Ensure Node.js compatibility
    minify: false, // Disable minification for easier debugging
    sourcemap: true, // Enable source maps for debugging
    commonjsOptions: {
      transformMixedEsModules: true
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  }
});
