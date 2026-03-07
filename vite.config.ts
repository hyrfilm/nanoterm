import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  if (mode === 'lib') {
    return {
      build: {
        lib: {
          entry: resolve(__dirname, 'src/lib/index.ts'),
          formats: ['es'],
          fileName: 'nanoterm',
        },
        rollupOptions: {
          external: ['@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-web-links'],
        },
        outDir: 'dist-lib',
        emptyOutDir: true,
      },
    }
  }

  return {
    plugins: [svelte()],
  }
})
