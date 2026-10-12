import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, writeFile, mkdir, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { scanDirectory } from '../../../src/main/mcp/tools/scan-folder'

describe('scanDirectory', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'mcp-scan-'))
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('should list files in a flat directory', async () => {
    await writeFile(join(tempDir, 'readme.txt'), 'hello')
    await writeFile(join(tempDir, 'photo.jpg'), Buffer.alloc(2048))

    const entries = await scanDirectory(tempDir, false, 3)

    expect(entries).toHaveLength(2)

    const txt = entries.find((e) => e.name === 'readme.txt')
    expect(txt).toBeDefined()
    expect(txt!.extension).toBe('.txt')
    expect(txt!.isDirectory).toBe(false)
    expect(txt!.size).toBe(5)

    const jpg = entries.find((e) => e.name === 'photo.jpg')
    expect(jpg).toBeDefined()
    expect(jpg!.extension).toBe('.jpg')
    expect(jpg!.size).toBe(2048)
  })

  it('should include directories in the listing', async () => {
    await mkdir(join(tempDir, 'subdir'))
    await writeFile(join(tempDir, 'file.md'), 'content')

    const entries = await scanDirectory(tempDir, false, 3)

    const dir = entries.find((e) => e.name === 'subdir')
    expect(dir).toBeDefined()
    expect(dir!.isDirectory).toBe(true)
    expect(dir!.extension).toBe('')
  })

  it('should scan recursively when enabled', async () => {
    await mkdir(join(tempDir, 'sub'))
    await writeFile(join(tempDir, 'root.txt'), 'root')
    await writeFile(join(tempDir, 'sub', 'child.txt'), 'child')

    const entries = await scanDirectory(tempDir, true, 3)

    const names = entries.map((e) => e.name)
    expect(names).toContain('root.txt')
    expect(names).toContain('sub')
    expect(names).toContain('child.txt')
  })

  it('should not recurse when recursive is false', async () => {
    await mkdir(join(tempDir, 'sub'))
    await writeFile(join(tempDir, 'sub', 'hidden.txt'), 'hidden')

    const entries = await scanDirectory(tempDir, false, 3)

    const names = entries.map((e) => e.name)
    expect(names).toContain('sub')
    expect(names).not.toContain('hidden.txt')
  })

  it('should respect maxDepth', async () => {
    await mkdir(join(tempDir, 'a'))
    await mkdir(join(tempDir, 'a', 'b'))
    await writeFile(join(tempDir, 'a', 'level1.txt'), '1')
    await writeFile(join(tempDir, 'a', 'b', 'level2.txt'), '2')

    const entries = await scanDirectory(tempDir, true, 0)

    // maxDepth=0 means we only scan the top level, no recursion into children
    const names = entries.map((e) => e.name)
    expect(names).toContain('a')
    expect(names).not.toContain('level1.txt')
    expect(names).not.toContain('level2.txt')
  })

  it('should return an empty array for an empty directory', async () => {
    const entries = await scanDirectory(tempDir, false, 3)
    expect(entries).toEqual([])
  })
})
