import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, copyFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { fileFingerprint } from '../../../src/main/domain/shared/fileFingerprint'

describe('fileFingerprint', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'talyx-fp-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('should give the same fingerprint after rename/copy (same content)', async () => {
    const a = join(dir, 'invoice-march.pdf')
    writeFileSync(a, 'identical content here')
    const b = join(dir, 'renamed-and-moved.pdf')
    copyFileSync(a, b)

    expect(await fileFingerprint(a)).toBe(await fileFingerprint(b))
  })

  it('should give different fingerprints for different content', async () => {
    const a = join(dir, 'a.txt')
    const b = join(dir, 'b.txt')
    writeFileSync(a, 'content A')
    writeFileSync(b, 'content B')

    expect(await fileFingerprint(a)).not.toBe(await fileFingerprint(b))
  })

  it('should distinguish files with identical first megabyte but different size', async () => {
    const oneMb = Buffer.alloc(1024 * 1024, 7)
    const a = join(dir, 'a.bin')
    const b = join(dir, 'b.bin')
    writeFileSync(a, oneMb)
    writeFileSync(b, Buffer.concat([oneMb, Buffer.from('tail')]))

    expect(await fileFingerprint(a)).not.toBe(await fileFingerprint(b))
  })

  it('should reject for unreadable paths', async () => {
    await expect(fileFingerprint(join(dir, 'missing.txt'))).rejects.toThrow()
  })
})
