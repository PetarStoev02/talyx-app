import { describe, it, expect, vi } from 'vitest'
import { CapabilityRegistry } from '../../../../src/main/domain/instruction/model/CapabilityRegistry'
import { recallCapabilities } from '../../../../src/main/domain/instruction/capabilities/recall'
import type { CapabilityContext } from '../../../../src/main/domain/instruction/model/Capability'
import type { RecallResult } from '../../../../src/main/domain/search/services/RecallService'

const ctx: CapabilityContext = {
  home: '/Users/test',
  projectsRoot: '/Users/test/Code',
  signal: new AbortController().signal,
  logger: { info: () => {}, warn: () => {} }
}

describe('recall capability', () => {
  it('should answer with files and conversation evidence', async () => {
    const result: RecallResult = {
      query: 'Acme',
      hits: [
        {
          kind: 'file',
          path: '/docs/invoice.pdf',
          name: 'invoice.pdf',
          snippet: 'Acme Ltd',
          rank: 2
        },
        {
          kind: 'conversation',
          id: 'c1',
          title: 'sort Acme invoice',
          snippet: 'sort Acme invoice',
          updatedAt: 1,
          rank: 100
        }
      ]
    }
    const recall = vi.fn(() => result)
    const capability = new CapabilityRegistry(recallCapabilities({ recall })).get('recall')!
    const proposal = await capability.plan(capability.params.parse({ query: 'Acme' }), ctx)

    expect(recall).toHaveBeenCalledWith('Acme', 20)
    if (proposal.kind !== 'answer') throw new Error('expected answer')
    expect(proposal.summary).toContain('1 file')
    expect(proposal.summary).toContain('1 conversation')
    expect(proposal.evidence).toEqual([
      { text: 'Acme Ltd', source: '/docs/invoice.pdf' },
      { text: 'sort Acme invoice', source: 'conversation:c1' }
    ])
    expect(proposal.card?.kind).toBe('paths')
  })

  it('should say so when nothing matches', async () => {
    const capability = new CapabilityRegistry(
      recallCapabilities({ recall: () => ({ query: 'zzz', hits: [] }) })
    ).get('recall')!
    const proposal = await capability.plan(capability.params.parse({ query: 'zzz' }), ctx)
    if (proposal.kind !== 'answer') throw new Error('expected answer')
    expect(proposal.summary).toContain('Nothing matches')
    expect(proposal.evidence).toEqual([])
  })
})
