import { describe, it, expect } from 'vitest'
import { deriveRecentSorts } from '../../src/renderer/src/widgets/app-shell/deriveRecentSorts'
import type { SortBatch } from '../../src/renderer/src/shared/api/ipc'

const batch = (id: string, src: string, n: number, undoneAt: string | null = null): SortBatch => ({
  batchId: id,
  timestamp: '2026-09-03T10:00:00Z',
  totalFiles: n,
  undoneAt,
  operations: Array.from({ length: n }, (_, i) => ({
    batchId: id,
    sourcePath: `${src}/f${i}.txt`,
    destPath: `/out/Documents/f${i}.txt`,
    operationType: 'move' as const,
    category: 'Documents',
    subcategory: null,
    fileName: `f${i}.txt`,
    fileSize: 1,
    createdAt: '2026-09-03T10:00:00Z'
  }))
})

describe('deriveRecentSorts', () => {
  it('should label rows by source folder and cap at five', () => {
    const rows = deriveRecentSorts([
      batch('b1', '/Users/p/Downloads', 12),
      batch('b2', '/Users/p/Desktop/scans', 3, '2026-09-03T11:00:00Z'),
      ...['b3', 'b4', 'b5', 'b6'].map((id) => batch(id, '/tmp/x', 1))
    ])
    expect(rows).toHaveLength(5)
    expect(rows[0]).toMatchObject({
      batchId: 'b1',
      label: 'Downloads',
      fileCount: 12,
      undoneAt: null
    })
    expect(rows[1].label).toBe('scans')
    expect(rows[1].undoneAt).not.toBeNull()
  })

  it('should label windows-style paths by their source folder', () => {
    const rows = deriveRecentSorts([
      {
        ...batch('b7', 'ignored', 1),
        operations: [
          {
            ...batch('b7', 'ignored', 1).operations[0],
            sourcePath: 'C:\\Users\\p\\Downloads\\f0.txt'
          }
        ]
      }
    ])
    expect(rows[0].label).toBe('Downloads')
  })

  it('should fall back to a placeholder when a batch has no operations', () => {
    const empty = { ...batch('b8', '/tmp/x', 0), operations: [] }
    expect(deriveRecentSorts([empty])[0].label).toBe('—')
  })

  it('should return empty for no history', () => {
    expect(deriveRecentSorts([])).toEqual([])
  })
})
