import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LogoStore } from '../../../src/main/infrastructure/office/LogoStore'
import { InvalidLogoError } from '../../../src/main/domain/office/errors'

describe('LogoStore', () => {
  const dir = mkdtempSync(join(tmpdir(), 'logos-'))
  const store = new LogoStore(join(dir, 'data'))
  const source = (name: string, bytes: number): string => {
    const path = join(dir, name)
    writeFileSync(path, Buffer.alloc(bytes, 1))
    return path
  }

  it('should copy a png and serve it as a data url', () => {
    const stored = store.store('p', source('logo.PNG', 10))
    expect(stored).not.toBe(join(dir, 'logo.PNG'))
    expect(store.dataUrl(stored)).toBe(
      `data:image/png;base64,${Buffer.alloc(10, 1).toString('base64')}`
    )
  })

  it.each([
    ['other formats', 'logo.gif', 10],
    ['files over 256 KB', 'big.svg', 256 * 1024 + 1]
  ])('should refuse %s', (_label, name, bytes) => {
    expect(() => store.store('p', source(name, bytes))).toThrow(InvalidLogoError)
  })

  it('should have no data url for a missing file', () => {
    expect(store.dataUrl(join(dir, 'missing.png'))).toBeNull()
  })
})
