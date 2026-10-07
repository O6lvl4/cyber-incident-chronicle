import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// GitHub Pages serves the site under /<repo>/; CI passes the repo name via BASE_PATH.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build: { sourcemap: false, target: 'es2022' },
  optimizeDeps: { exclude: ['@duckdb/duckdb-wasm'] },
});
