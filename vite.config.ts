import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// `base` defaults to '/' (Docker/nginx serves at root). The GitHub Pages build
// sets VITE_BASE=/dbml-flow/ so assets resolve under the project-pages subpath.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
});
