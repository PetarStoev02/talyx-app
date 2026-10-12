import { describe, it, expect, vi } from 'vitest'
import { RecallService } from '../../src/main/domain/search/services/RecallService'
import type { SearchIndexRepo } from '../../src/main/domain/search/repository/SearchIndexRepo'
import type { ConversationRepo } from '../../src/main/domain/conversation/repository/ConversationRepo'

function files(hits: { filePath: string; snippet: string; rank: number }[] = []): SearchIndexRepo {
  return {
    searchKeyword: vi.fn(() => hits)
  } as unknown as SearchIndexRepo
}

function chats(
  hits: {
    id: string
    title: string
    snippet: string
    updatedAt: number
    rank: number
  }[] = []
): ConversationRepo {
  return {
    search: vi.fn(() => hits)
  } as unknown as ConversationRepo
}

describe('RecallService', () => {
  it('should return nothing for an empty query', () => {
    const service = new RecallService(
      files([{ filePath: '/a.pdf', snippet: 'x', rank: -1 }]),
      chats()
    )
    expect(service.recall('  ')).toEqual({ query: '', hits: [] })
  })

  it('should return files when there are no chats', () => {
    const service = new RecallService(
      files([{ filePath: '/docs/invoice.pdf', snippet: 'Acme', rank: -2 }]),
      chats()
    )
    const result = service.recall('Acme')
    expect(result.hits).toEqual([
      {
        kind: 'file',
        path: '/docs/invoice.pdf',
        name: 'invoice.pdf',
        snippet: 'Acme',
        rank: 2
      }
    ])
  })

  it('should return chats when there are no files', () => {
    const service = new RecallService(
      files(),
      chats([
        {
          id: 'c1',
          title: 'sort downloads',
          snippet: 'sort downloads',
          updatedAt: 100,
          rank: 100
        }
      ])
    )
    const result = service.recall('downloads')
    expect(result.hits).toHaveLength(1)
    expect(result.hits[0]).toMatchObject({ kind: 'conversation', id: 'c1' })
  })

  it('should interleave files and chats by rank', () => {
    const service = new RecallService(
      files([{ filePath: '/a.pdf', snippet: 'low', rank: -1 }]),
      chats([
        {
          id: 'c1',
          title: 'high',
          snippet: 'high',
          updatedAt: 1,
          rank: 100
        }
      ])
    )
    expect(service.recall('x').hits.map((h) => h.kind)).toEqual(['conversation', 'file'])
  })

  it('should stop at the limit across both sources', () => {
    const service = new RecallService(
      files([
        { filePath: '/1.pdf', snippet: 'a', rank: -5 },
        { filePath: '/2.pdf', snippet: 'a', rank: -4 }
      ]),
      chats([
        { id: 'c1', title: 'a', snippet: 'a', updatedAt: 1, rank: 50 },
        { id: 'c2', title: 'a', snippet: 'a', updatedAt: 1, rank: 40 }
      ])
    )
    expect(service.recall('a', { limit: 2 }).hits).toHaveLength(2)
  })
})
