import { describe, it, expect } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { applyFilePayload } from '../../../src/main/infrastructure/agent/applyFilePayload'
import { TargetExistsError } from '../../../src/main/domain/agent/errors'

async function neverTrash(): Promise<void> {
  throw new Error('trashItem should not be reached')
}

function tempFiles(): { dir: string; source: string; target: string } {
  const dir = mkdtempSync(join(tmpdir(), 'talyx-apply-'))
  const source = join(dir, 'source.txt')
  const target = join(dir, 'nested', 'target.txt')
  writeFileSync(source, 'source contents')
  return { dir, source, target }
}

describe('applyFilePayload', () => {
  it('should move a file into a folder it creates', async () => {
    const { source, target } = tempFiles()
    await applyFilePayload({ kind: 'move', sourcePath: source, targetPath: target }, neverTrash)
    expect(existsSync(source)).toBe(false)
    expect(readFileSync(target, 'utf8')).toBe('source contents')
  })

  it('should refuse to move onto an existing file and leave both untouched', async () => {
    const { dir, source } = tempFiles()
    const target = join(dir, 'target.txt')
    writeFileSync(target, 'target contents')

    await expect(
      applyFilePayload({ kind: 'move', sourcePath: source, targetPath: target }, neverTrash)
    ).rejects.toBeInstanceOf(TargetExistsError)

    expect(readFileSync(source, 'utf8')).toBe('source contents')
    expect(readFileSync(target, 'utf8')).toBe('target contents')
  })

  it('should refuse to copy onto an existing file', async () => {
    const { dir, source } = tempFiles()
    const target = join(dir, 'target.txt')
    writeFileSync(target, 'target contents')

    await expect(
      applyFilePayload({ kind: 'copy', sourcePath: source, targetPath: target }, neverTrash)
    ).rejects.toBeInstanceOf(TargetExistsError)

    expect(readFileSync(target, 'utf8')).toBe('target contents')
  })

  it('should hand a trash payload to the injected trash function', async () => {
    const { source } = tempFiles()
    const trashed: string[] = []
    await applyFilePayload({ kind: 'trash', sourcePath: source }, async (p) => {
      trashed.push(p)
    })
    expect(trashed).toEqual([source])
  })
})
