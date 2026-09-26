import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  envDir: fileURLToPath(new URL('./tests/', import.meta.url)),
  test: {
    include: ['tests/unit/**/*.test.js'],
    environment: 'node',
    env: { TZ: 'Europe/Athens' },
  },
})
