import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, writeFile, symlink, rm, mkdir } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { walkDir } from '../../../src/main/domain/shared/walkDir'

describe('walkDir', () => {
  let root: string
  let outside: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'walk-root-'))
    outside = await mkdtemp(join(tmpdir(), 'walk-outside-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
    await rm(outside, { recursive: true, force: true })
  })

  it('should skip a symlink to a file outside the folder', async () => {
    await writeFile(join(root, 'a.txt'), 'a')
    await writeFile(join(outside, 'credentials'), 'secret')
    await symlink(join(outside, 'credentials'), join(root, 'credentials'))

    const names = (await walkDir(root)).map((f) => f.name)

    expect(names).toEqual(['a.txt'])
  })

  it('should not loop on a symlink to its own parent', async () => {
    await mkdir(join(root, 'sub'))
    await writeFile(join(root, 'sub', 'b.txt'), 'b')
    await symlink(root, join(root, 'sub', 'loop'))

    const names = (await walkDir(root)).map((f) => f.name)

    expect(names).toEqual(['b.txt'])
  })
})
