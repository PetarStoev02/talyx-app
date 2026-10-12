import { z } from 'zod/v4'
import type { Capability, Proposal } from '../model/Capability'
import type { Effect } from '../model/Effect'
import type { RecallHit, RecallResult } from '../../search/services/RecallService'

const READ_ONLY: Effect = { reversible: false, world: 'reads', discloses: 'query' }

export interface RecallCapabilityDeps {
  recall(query: string, limit: number): RecallResult
}

export function recallCapabilities(deps: RecallCapabilityDeps): Capability[] {
  const recall: Capability<{ query: string; limit: number }> = {
    name: 'recall',
    description:
      'Search indexed files and past assistant conversations in one query. Prefer this over search_files when the owner might mean either.',
    examples: [
      'find that chat about the invoice',
      'where did we talk about downloads',
      'search for the lease and any past conversation about it'
    ],
    params: z.object({
      query: z.string().min(1).describe('What to look for in files and past chats'),
      limit: z.number().int().min(1).max(50).default(20)
    }),
    effect: READ_ONLY,
    async plan({ query, limit }): Promise<Proposal> {
      const result = deps.recall(query, limit)
      return answerFromHits(query, result.hits)
    }
  }

  return [recall as Capability]
}

function answerFromHits(query: string, hits: RecallHit[]): Proposal {
  if (hits.length === 0) {
    return { kind: 'answer', summary: `Nothing matches "${query}"`, evidence: [] }
  }

  const files = hits.filter((h): h is Extract<RecallHit, { kind: 'file' }> => h.kind === 'file')
  const chats = hits.filter(
    (h): h is Extract<RecallHit, { kind: 'conversation' }> => h.kind === 'conversation'
  )

  const parts: string[] = []
  if (files.length > 0) {
    parts.push(`${files.length} file${files.length === 1 ? '' : 's'}`)
  }
  if (chats.length > 0) {
    parts.push(`${chats.length} conversation${chats.length === 1 ? '' : 's'}`)
  }

  return {
    kind: 'answer',
    summary: `${parts.join(' and ')} matching "${query}"`,
    evidence: [
      ...files.map((f) => ({ text: f.snippet, source: f.path })),
      ...chats.map((c) => ({ text: c.snippet, source: `conversation:${c.id}` }))
    ],
    ...(files.length > 0
      ? {
          card: {
            kind: 'paths' as const,
            entries: files.map((f) => ({
              path: f.path,
              label: f.name,
              snippet: f.snippet,
              isDirectory: false
            }))
          }
        }
      : {})
  }
}
