import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({ net: {}, protocol: {} }))

import { rendererFile } from '../../../src/main/infrastructure/security/appProtocol'

const RENDERER = '/Applications/Talyx.app/Contents/Resources/app.asar/out/renderer'

describe('rendererFile', () => {
  it.each([
    ['app://talyx/index.html', `${RENDERER}/index.html`],
    ['app://talyx/assets/index-abc.js?v=1#x', `${RENDERER}/assets/index-abc.js`],
    ['app://talyx/fonts/Geist%20Mono.woff2', `${RENDERER}/fonts/Geist Mono.woff2`]
  ])('should serve %s from the renderer folder', (url, file) => {
    expect(rendererFile(url, RENDERER)).toBe(file)
  })

  it.each([
    ['the folder itself', 'app://talyx/'],
    ['an encoded parent step', 'app://talyx/..%2F..%2Fapp.asar.unpacked%2Fx'],
    ['an encoded absolute path', 'app://talyx/%2F..%2F..%2Fetc%2Fpasswd'],
    ['broken percent-encoding', 'app://talyx/%E0%A4%A'],
    ['another host', 'app://other/index.html'],
    ['another scheme', 'file:///etc/passwd']
  ])('should refuse %s', (_case, url) => {
    expect(rendererFile(url, RENDERER)).toBeNull()
  })
})
