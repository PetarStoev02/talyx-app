import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

describe('renderer CSP', () => {
  it('should let the renderer connect only to itself', () => {
    const html = readFileSync('src/renderer/index.html', 'utf8')
    const connectSrc = /connect-src ([^;"]+)/.exec(html)?.[1] ?? ''
    expect(connectSrc.trim()).toBe("'self'")
  })
})
