import path from 'path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** The Electron renderer, rendered verbatim inside the landing page's demo iframe. */
const renderer = path.resolve(__dirname, '../src/renderer/src')
const site = path.resolve(__dirname, 'src')
const websitePkg = path.resolve(__dirname, 'package.json')
// The renderer, and the roster fixture's engine double the demo runs on (and the unit double it uses).
const borrowedSegments = [
  ['src', 'renderer'],
  ['tests', 'fixtures'],
  ['tests', 'unit', 'providers']
].map((parts) => path.sep + parts.join(path.sep) + path.sep)

/** Vercel installs only website/node_modules; borrowed files' imports must not walk the repo root. */
function resolveRendererDepsFromWebsite(): Plugin {
  return {
    name: 'resolve-renderer-deps-from-website',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!borrowedSegments.some((segment) => importer?.includes(segment))) return null
      if (source.startsWith('.') || path.isAbsolute(source)) return null
      if (/^@(app|pages|widgets|features|entities|shared|renderer)(\/|$)/.test(source)) return null
      if (source.startsWith('@/')) return null
      return this.resolve(source, websitePkg, { skipSelf: true, ...options })
    }
  }
}

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [resolveRendererDepsFromWebsite(), react(), tailwindcss()],
  base: '/',
  // The prerendered footer and the hydrating client must print the same year.
  define: { __BUILD_YEAR__: JSON.stringify(new Date().getFullYear()) },
  resolve: {
    alias: [
      // Both trees spell their own root `@/` and both have a `shared/`, so the
      // target depends on who is asking.
      {
        find: /^@\//,
        replacement: '',
        customResolver(source, importer) {
          const base = importer?.startsWith(renderer) ? renderer : site
          return this.resolve(path.join(base, source), importer, { skipSelf: true })
        }
      },
      { find: '@renderer', replacement: renderer },
      { find: '@app', replacement: path.join(renderer, 'app') },
      { find: '@pages', replacement: path.join(renderer, 'pages') },
      { find: '@widgets', replacement: path.join(renderer, 'widgets') },
      { find: '@features', replacement: path.join(renderer, 'features') },
      { find: '@entities', replacement: path.join(renderer, 'entities') },
      { find: '@shared', replacement: path.join(renderer, 'shared') }
    ],
    // The renderer resolves React from the repo root, the site from website/.
    dedupe: ['react', 'react-dom']
  },
  server: {
    fs: { allow: [path.resolve(__dirname, '..')] }
  },
  build: {
    outDir: 'dist',
    rollupOptions: isSsrBuild
      ? undefined
      : {
          input: {
            main: path.resolve(__dirname, 'index.html'),
            appDemo: path.resolve(__dirname, 'app-demo.html')
          }
        }
  },
  ssr: {
    noExternal: ['@tanstack/react-router', '@tanstack/router-core', '@tanstack/history']
  }
}))
