import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    setupFiles: ['tests/unit/propertySeed.ts'],
    // A global or env stubbed in one example is undone before the next, so no test passes on
    // another's leftovers.
    unstubGlobals: true,
    unstubEnvs: true
  },
  resolve: {
    alias: {
      '@shared': resolve('src/renderer/src/shared'),
      '@app': resolve('src/renderer/src/app'),
      '@features': resolve('src/renderer/src/features'),
      '@widgets': resolve('src/renderer/src/widgets'),
      '@contract': resolve('src/shared')
    }
  }
})
