import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import blogPlugin from './blog-plugin.js'

export default defineConfig({
  plugins: [blogPlugin()],
  envDir: fileURLToPath(new URL('./tests/', import.meta.url)),
  test: {
    include: ['tests/unit/**/*.test.js'],
    environment: 'node',
    env: { TZ: 'Europe/Athens' },
  },
})
