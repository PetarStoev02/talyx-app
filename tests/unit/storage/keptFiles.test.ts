import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NotADataUrlError, keepFile } from '../../../src/main/infrastructure/storage/keptFiles'

function dataUrlOf(text: string, mime = 'application/pdf'): string {
  return `data:${mime};base64,${Buffer.from(text).toString('base64')}`
}

describe('keepFile', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'talyx-kept-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('should save the file under its own name and return where it is', async () => {
    const path = await keepFile(root, { name: 'invoice 148890.pdf', dataUrl: dataUrlOf('%PDF-1') })
    expect(path.startsWith(root)).toBe(true)
    expect(path.endsWith('/invoice 148890.pdf')).toBe(true)
    expect(await readFile(path, 'utf8')).toBe('%PDF-1')
  })

  it('should keep two files with the same name apart', async () => {
    const first = await keepFile(root, { name: 'notes.md', dataUrl: dataUrlOf('one') })
    const second = await keepFile(root, { name: 'notes.md', dataUrl: dataUrlOf('two') })
    expect(first).not.toBe(second)
    expect(await readFile(first, 'utf8')).toBe('one')
    expect(await readFile(second, 'utf8')).toBe('two')
  })

  it('should save an empty file', async () => {
    const path = await keepFile(root, { name: 'empty.txt', dataUrl: 'data:text/plain;base64,' })
    expect(await readFile(path, 'utf8')).toBe('')
  })

  it.each([
    ['../../escape.txt', 'escape.txt'],
    ['/etc/passwd', 'passwd'],
    ['..', 'file'],
    ['', 'file']
  ])('should never write outside its folder for the name %j', async (name, saved) => {
    const path = await keepFile(root, { name, dataUrl: dataUrlOf('x') })
    expect(dirname(dirname(path))).toBe(root)
    expect(path.endsWith(`/${saved}`)).toBe(true)
  })

  it('should refuse something that is not a base64 data URL', async () => {
    await expect(
      keepFile(root, { name: 'a.txt', dataUrl: 'https://example.com/a.txt' })
    ).rejects.toThrow(NotADataUrlError)
  })
})
