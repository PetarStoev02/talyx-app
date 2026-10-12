import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts']
  },
  resolve: {
    alias: {
      '@shared': resolve('src/renderer/src/shared'),
      '@app': resolve('src/renderer/src/app'),
      '@features': resolve('src/renderer/src/features'),
      '@widgets': resolve('src/renderer/src/widgets')
    }
  }
})
