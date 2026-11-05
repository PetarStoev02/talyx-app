import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

function directive(page: string, name: string): string {
  const html = readFileSync(`src/renderer/${page}`, 'utf8')
  return new RegExp(`${name} ([^;"]+)`).exec(html)?.[1]?.trim() ?? ''
}

describe('renderer CSP', () => {
  it('should let the renderer connect only to itself', () => {
    expect(directive('index.html', 'connect-src')).toBe("'self'")
  })

  // A model-written markdown image must never load from the web: its URL would leak data with
  // no click at all. Media from the engine arrives as data URLs.
  it.each(['index.html', 'splash.html'])('should load images only from %s itself', (page) => {
    expect(directive(page, 'img-src')).toBe("'self' data:")
  })

  it.each(['index.html', 'splash.html'])('should run only the app scripts in %s', (page) => {
    expect(directive(page, 'script-src')).toBe("'self'")
  })
})
