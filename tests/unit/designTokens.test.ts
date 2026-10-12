import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const RENDERER_SRC = join(__dirname, '../../src/renderer/src')
const BANNED =
  /\b(?:text|bg|border|accent|ring|fill|stroke|hover:text|hover:bg|hover:border|dark:text|dark:bg|dark:border)-(?:red|green|blue|yellow|amber|emerald|purple|violet|indigo|pink|orange|teal|cyan|lime|rose|fuchsia|sky)-\d+/g

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return walk(full)
    return /\.(tsx?|css)$/.test(entry) ? [full] : []
  })
}

describe('design tokens', () => {
  it('should not use raw Tailwind palette classes — use semantic tokens', () => {
    const offenders = walk(RENDERER_SRC).flatMap((file) => {
      const matches = readFileSync(file, 'utf-8').match(BANNED)
      return matches
        ? [`${file.replace(RENDERER_SRC, '')}: ${[...new Set(matches)].join(', ')}`]
        : []
    })
    expect(offenders).toEqual([])
  })

  it('should define every semantic token in both themes', () => {
    const css = readFileSync(join(RENDERER_SRC, 'assets/theme.css'), 'utf-8')
    for (const token of [
      '--success',
      '--success-subtle',
      '--warning',
      '--warning-subtle',
      '--info',
      '--info-subtle',
      '--destructive-subtle'
    ]) {
      const occurrences = css.split(`${token}:`).length - 1
      expect(occurrences, `${token} must be set in :root and .dark`).toBeGreaterThanOrEqual(2)
    }
  })
})
