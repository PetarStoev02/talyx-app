import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { DuplicateDetector } from '../../../src/main/domain/sorting/services/DuplicateDetector'

describe('DuplicateDetector', () => {
  let detector: DuplicateDetector
  let tempDir: string

  beforeEach(() => {
    detector = new DuplicateDetector()
    tempDir = mkdtempSync(join(tmpdir(), 'talyx-dup-test-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  function createFile(name: string, content: string): string {
    const filePath = join(tempDir, name)
    const dir = filePath.substring(0, filePath.lastIndexOf('/'))
    mkdirSync(dir, { recursive: true })
    writeFileSync(filePath, content)
    return filePath
  }

  describe('hashFile', () => {
    it('produces consistent hash for same content', async () => {
      const file1 = createFile('a.txt', 'hello world')
      const file2 = createFile('b.txt', 'hello world')

      const hash1 = await detector.hashFile(file1)
      const hash2 = await detector.hashFile(file2)

      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(32) // MD5 hex length
    })

    it('produces different hash for different content', async () => {
      const file1 = createFile('a.txt', 'hello')
      const file2 = createFile('b.txt', 'world')

      const hash1 = await detector.hashFile(file1)
      const hash2 = await detector.hashFile(file2)

      expect(hash1).not.toBe(hash2)
    })

    it('handles empty files', async () => {
      const file = createFile('empty.txt', '')
      const hash = await detector.hashFile(file)
      expect(hash).toHaveLength(32)
    })

    it('rejects for non-existent files', async () => {
      await expect(detector.hashFile('/nonexistent/file.txt')).rejects.toThrow()
    })
  })

  describe('detect', () => {
    it('returns empty array when no duplicates', async () => {
      const file1 = createFile('a.txt', 'content A')
      const file2 = createFile('b.txt', 'content B')
      const file3 = createFile('c.txt', 'content C')

      const result = await detector.detect([
        { path: file1, size: 9 },
        { path: file2, size: 9 },
        { path: file3, size: 9 }
      ])

      expect(result).toEqual([])
    })

    it('detects exact duplicate pair', async () => {
      const file1 = createFile('a.txt', 'same content')
      const file2 = createFile('b.txt', 'same content')

      const result = await detector.detect([
        { path: file1, size: 12 },
        { path: file2, size: 12 }
      ])

      expect(result).toHaveLength(1)
      expect(result[0].paths).toHaveLength(2)
      expect(result[0].paths).toContain(file1)
      expect(result[0].paths).toContain(file2)
      expect(result[0].size).toBe(12)
    })

    it('detects multiple duplicate groups', async () => {
      const a1 = createFile('a1.txt', 'group A')
      const a2 = createFile('a2.txt', 'group A')
      const b1 = createFile('b1.txt', 'group BB')
      const b2 = createFile('b2.txt', 'group BB')
      const unique = createFile('unique.txt', 'unique content here')

      const result = await detector.detect([
        { path: a1, size: 7 },
        { path: a2, size: 7 },
        { path: b1, size: 8 },
        { path: b2, size: 8 },
        { path: unique, size: 19 }
      ])

      expect(result).toHaveLength(2)
    })

    it('detects groups with more than 2 duplicates', async () => {
      const f1 = createFile('f1.txt', 'triple')
      const f2 = createFile('f2.txt', 'triple')
      const f3 = createFile('f3.txt', 'triple')

      const result = await detector.detect([
        { path: f1, size: 6 },
        { path: f2, size: 6 },
        { path: f3, size: 6 }
      ])

      expect(result).toHaveLength(1)
      expect(result[0].paths).toHaveLength(3)
    })

    it('skips files with unique sizes (fast path)', async () => {
      const file1 = createFile('a.txt', 'short')
      const file2 = createFile('b.txt', 'much longer content')

      // Different sizes — should not hash at all
      const hashSpy = vi.spyOn(detector, 'hashFile')

      const result = await detector.detect([
        { path: file1, size: 5 },
        { path: file2, size: 19 }
      ])

      expect(result).toEqual([])
      expect(hashSpy).not.toHaveBeenCalled()
    })

    it('calls onProgress callback', async () => {
      const f1 = createFile('a.txt', 'same')
      const f2 = createFile('b.txt', 'same')

      const progressCalls: [number, number][] = []

      await detector.detect(
        [
          { path: f1, size: 4 },
          { path: f2, size: 4 }
        ],
        (current, total) => progressCalls.push([current, total])
      )

      expect(progressCalls.length).toBe(2)
      expect(progressCalls[0]).toEqual([1, 2])
      expect(progressCalls[1]).toEqual([2, 2])
    })

    it('returns empty array for empty input', async () => {
      const result = await detector.detect([])
      expect(result).toEqual([])
    })

    it('returns empty array for single file', async () => {
      const file = createFile('only.txt', 'content')
      const result = await detector.detect([{ path: file, size: 7 }])
      expect(result).toEqual([])
    })

    it('handles unreadable files gracefully', async () => {
      const file1 = createFile('a.txt', 'content')
      const fakePath = join(tempDir, 'nonexistent.txt')

      const result = await detector.detect([
        { path: file1, size: 7 },
        { path: fakePath, size: 7 }
      ])

      // No crash, no duplicates since one file couldn't be read
      expect(result).toEqual([])
    })

    it('differentiates files with same size but different content', async () => {
      const f1 = createFile('a.txt', 'aaaa')
      const f2 = createFile('b.txt', 'bbbb')

      const result = await detector.detect([
        { path: f1, size: 4 },
        { path: f2, size: 4 }
      ])

      expect(result).toEqual([])
    })
  })
})
