import { basename } from 'path'
import type { SearchIndexRepo } from '../repository/SearchIndexRepo'
import type { ConversationRepo } from '../../conversation/repository/ConversationRepo'

export type RecallHit =
  | {
      kind: 'file'
      path: string
      name: string
      snippet: string
      rank: number
    }
  | {
      kind: 'conversation'
      id: string
      title: string
      snippet: string
      updatedAt: number
      rank: number
    }

export interface RecallResult {
  query: string
  hits: RecallHit[]
}

const DEFAULT_LIMIT = 20

/**
 * One query → indexed files and past chats, interleaved by rank.
 */
export class RecallService {
  constructor(
    private readonly files: SearchIndexRepo,
    private readonly conversations: ConversationRepo
  ) {}

  recall(query: string, options?: { limit?: number }): RecallResult {
    const trimmed = query.trim()
    const limit = options?.limit ?? DEFAULT_LIMIT
    if (trimmed.length === 0 || limit <= 0) return { query: trimmed, hits: [] }

    // Fetch up to `limit` from each source, then merge and slice.
    const fileHits = this.files.searchKeyword(trimmed, limit).map(
      (hit): RecallHit => ({
        kind: 'file',
        path: hit.filePath,
        name: basename(hit.filePath),
        snippet: hit.snippet,
        // FTS rank is typically negative (better = more negative); flip for sort.
        rank: -hit.rank
      })
    )

    const chatHits = this.conversations.search(trimmed, limit).map(
      (hit): RecallHit => ({
        kind: 'conversation',
        id: hit.id,
        title: hit.title,
        snippet: hit.snippet,
        updatedAt: hit.updatedAt,
        rank: hit.rank
      })
    )

    const hits = [...fileHits, ...chatHits].sort((a, b) => {
      if (b.rank !== a.rank) return b.rank - a.rank
      // Stable-ish: files before chats on equal rank.
      if (a.kind !== b.kind) return a.kind === 'file' ? -1 : 1
      return 0
    })

    return { query: trimmed, hits: hits.slice(0, limit) }
  }
}
