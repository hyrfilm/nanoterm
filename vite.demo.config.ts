import { defineConfig } from 'vite';
import { resolve } from 'path';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  server: {
    open: '/demos/index.html',
  },
  build: {
    outDir: 'dist-demos',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        demo: resolve(__dirname, 'demos/index.html'),
      },
    },
  },
});
