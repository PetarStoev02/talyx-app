import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

// The pinned engine's install downloads and builds it; the teardown waits for its gateway to exit.
const INSTALL_AND_CHECKS_TIMEOUT_MS = 20 * 60_000
const TEARDOWN_TIMEOUT_MS = 3 * 60_000

/** The real-engine smoke suite (`npm run test:smoke`), kept out of the unit run. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/smoke/**/*.test.ts'],
    testTimeout: INSTALL_AND_CHECKS_TIMEOUT_MS,
    hookTimeout: TEARDOWN_TIMEOUT_MS
  },
  resolve: {
    // The core flows run the renderer's use cases, which import through its aliases.
    alias: {
      '@shared': resolve('src/renderer/src/shared'),
      '@app': resolve('src/renderer/src/app'),
      '@features': resolve('src/renderer/src/features'),
      '@contract': resolve('src/shared')
    }
  }
})
