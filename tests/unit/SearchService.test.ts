import { describe, it, expect, vi, beforeEach } from 'vitest'
import { existsSync } from 'fs'
import { SearchService } from '../../src/main/domain/search/services/SearchService'

vi.mock('fs', () => ({ existsSync: vi.fn(() => true) }))
const existsSyncMock = vi.mocked(existsSync)

function makeService(
  results: Array<{ filePath: string; snippet: string; rank: number }> = []
): SearchService {
  const mockSearchIndex = {
    searchKeyword: vi.fn().mockReturnValue(results),
    removeFile: vi.fn()
  }
  return new SearchService(mockSearchIndex as never)
}

describe('SearchService', () => {
  beforeEach(() => {
    existsSyncMock.mockReset()
    existsSyncMock.mockReturnValue(true)
  })

  it('should return empty array for empty query', async () => {
    const service = makeService()
    const results = await service.search('')
    expect(results).toEqual([])
  })

  it('should return keyword results from the index', async () => {
    const service = makeService([{ filePath: '/a.pdf', snippet: 'WW2 history', rank: -5 }])
    const results = await service.search('WW2')
    expect(results.length).toBe(1)
    expect(results[0].filePath).toBe('/a.pdf')
    expect(results[0].category).toBe('Documents')
  })

  it('should label an archive hit with the sorting category', async () => {
    const service = makeService([{ filePath: '/backup.zip', snippet: 'backup', rank: -5 }])
    const results = await service.search('backup')
    expect(results[0].category).toBe('Archives')
  })

  it('should filter to the intended category when the query names one', async () => {
    const service = makeService([
      { filePath: '/cursor.png', snippet: 'cursor image', rank: -5 },
      { filePath: '/cursor.php', snippet: 'cursor code', rank: -3 }
    ])
    const results = await service.search('find me an image from cursor')
    expect(results.length).toBe(1)
    expect(results[0].filePath).toBe('/cursor.png')
    expect(results[0].category).toBe('Images')
  })

  it('should keep unfiltered results when category filter would empty the set', async () => {
    const service = makeService([{ filePath: '/cursor.php', snippet: 'cursor code', rank: -3 }])
    const results = await service.search('find me an image from cursor')
    expect(results.length).toBe(1)
    expect(results[0].filePath).toBe('/cursor.php')
  })

  it('should rank filename matches above non-matches', async () => {
    const service = makeService([
      { filePath: '/notes/random.txt', snippet: 'mentions invoice', rank: -2 },
      { filePath: '/docs/invoice-march.pdf', snippet: 'invoice', rank: -1 }
    ])
    const results = await service.search('invoice march')
    expect(results[0].filePath).toBe('/docs/invoice-march.pdf')
  })

  it('should drop and forget a hit whose file no longer exists', async () => {
    const mockSearchIndex = {
      searchKeyword: vi.fn().mockReturnValue([
        { filePath: '/docs/gone.pdf', snippet: 'invoice', rank: -5 },
        { filePath: '/docs/here.pdf', snippet: 'invoice', rank: -4 }
      ]),
      removeFile: vi.fn()
    }
    existsSyncMock.mockImplementation((p) => p !== '/docs/gone.pdf')
    const service = new SearchService(mockSearchIndex as never)

    const results = await service.search('invoice')

    expect(results.map((r) => r.filePath)).toEqual(['/docs/here.pdf'])
    expect(mockSearchIndex.removeFile).toHaveBeenCalledWith('/docs/gone.pdf')
  })

  it('should drop but keep a hit on an unplugged drive', async () => {
    const mockSearchIndex = {
      searchKeyword: vi
        .fn()
        .mockReturnValue([
          { filePath: '/Volumes/Backup/invoice.pdf', snippet: 'invoice', rank: -5 }
        ]),
      removeFile: vi.fn()
    }
    // Neither the file nor the folder it lived in is there — the whole disk is gone.
    existsSyncMock.mockReturnValue(false)
    const service = new SearchService(mockSearchIndex as never)

    const results = await service.search('invoice')

    expect(results).toEqual([])
    expect(mockSearchIndex.removeFile).not.toHaveBeenCalled()
  })

  it('should respect the result limit', async () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      filePath: `/file-${i}.txt`,
      snippet: 'match',
      rank: -1
    }))
    const service = makeService(many)
    const results = await service.search('file', 5)
    expect(results.length).toBe(5)
  })
})
