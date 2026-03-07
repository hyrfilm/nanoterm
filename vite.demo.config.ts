import { defineConfig } from 'vite';
import { resolve } from 'path';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  server: {
    open: '/demos/default/index.html',
  },
  build: {
    outDir: 'dist-demos',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        default: resolve(__dirname, 'demos/default/index.html'),
        minimal: resolve(__dirname, 'demos/minimal/index.html'),
      },
    },
  },
});
