import { randomUUID } from 'crypto'
import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// One secret per dev run, shared with the Electron main process through the environment it
// inherits: the browser dev bridge then answers only what came through this proxy.
const bridgeToken = (process.env.TALYX_BRIDGE_TOKEN ??= randomUUID())

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts')
        }
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/preload/index.ts'),
          splash: resolve('src/splash/preload.ts')
        }
      }
    }
  },
  renderer: {
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          splash: resolve('src/renderer/splash.html')
        }
      }
    },
    server: {
      proxy: {
        // Browser dev bridge: same-origin path into the Electron main process
        '/bridge': {
          target: `http://127.0.0.1:${process.env.TALYX_BRIDGE_PORT ?? 5175}`,
          changeOrigin: true,
          // The name is BRIDGE_TOKEN_HEADER in DevBridge.ts.
          headers: { 'x-talyx-bridge-token': bridgeToken }
        }
      }
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@': resolve('src/renderer/src'),
        '@app': resolve('src/renderer/src/app'),
        '@pages': resolve('src/renderer/src/pages'),
        '@widgets': resolve('src/renderer/src/widgets'),
        '@features': resolve('src/renderer/src/features'),
        '@shared': resolve('src/renderer/src/shared')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
