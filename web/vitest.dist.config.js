import { defineConfig } from 'vitest/config'
import base from './vitest.config.js'

export default defineConfig({
  ...base,
  test: { ...base.test, env: { ...base.test.env, PROD: 'true' }, include: ['tests/dist/**/*.test.js'] },
})
