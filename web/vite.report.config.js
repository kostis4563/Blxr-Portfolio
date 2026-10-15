import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  publicDir: false,
  plugins: [react(), tailwindcss()],
  build: {
    emptyOutDir: false,
    sourcemap: false,
    rollupOptions: {
      input: { report: fileURLToPath(new URL('./report.html', import.meta.url)) },
    },
  },
})
