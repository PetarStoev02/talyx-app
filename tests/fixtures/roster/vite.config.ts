import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({
  root: resolve('tests/fixtures/roster'),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: Object.fromEntries(
      ['app', 'features', 'pages', 'widgets', 'shared']
        .map((name) => [`@${name}`, resolve(`src/renderer/src/${name}`)])
        .concat([['@', resolve('src/renderer/src')]])
    )
  },
  server: { host: '127.0.0.1', port: 5183, strictPort: true }
})
