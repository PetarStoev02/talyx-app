import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import pkg from './package.json'

export default defineConfig({
  main: {
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version)
    },
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
          index: resolve('src/preload/index.ts')
        }
      }
    }
  },
  renderer: {
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html')
        }
      }
    },
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version)
    },
    server: {
      proxy: {
        // Browser dev bridge: same-origin path into the Electron main process
        '/bridge': {
          target: `http://127.0.0.1:${process.env.TALYX_BRIDGE_PORT ?? 5175}`,
          changeOrigin: true
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
