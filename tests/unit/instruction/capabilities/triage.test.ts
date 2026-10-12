import { describe, it, expect, vi } from 'vitest'
import { CapabilityRegistry } from '../../../../src/main/domain/instruction/model/CapabilityRegistry'
import { triageCapabilities } from '../../../../src/main/domain/instruction/capabilities/triage'
import type { CapabilityContext } from '../../../../src/main/domain/instruction/model/Capability'
import type { TriageResult } from '../../../../src/main/domain/briefing/services/TriageService'

const ctx: CapabilityContext = {
  home: '/Users/test',
  projectsRoot: '/Users/test/Code',
  signal: new AbortController().signal,
  logger: { info: () => {}, warn: () => {} }
}

describe('triage capability', () => {
  it('should answer with ranked evidence when items exist', async () => {
    const result: TriageResult = {
      items: [
        {
          kind: 'meeting',
          title: 'Starting soon',
          body: 'Standup in 5 min',
          rank: 1,
          card: { kind: 'agenda', day: 'today', events: [] }
        },
        { kind: 'disk', title: 'Disk full', body: '5% free', rank: 3, card: null }
      ],
      summary: "Here's what needs you now:\n\n1. **Starting soon** — Standup in 5 min",
      card: { kind: 'agenda', day: 'today', events: [] }
    }
    const triage = vi.fn(async () => result)
    const capability = new CapabilityRegistry(triageCapabilities({ triage })).get('triage')!
    const proposal = await capability.plan(capability.params.parse({}), ctx)

    expect(triage).toHaveBeenCalled()
    if (proposal.kind !== 'answer') throw new Error('expected answer')
    expect(proposal.summary).toContain('Starting soon')
    expect(proposal.card?.kind).toBe('agenda')
    expect(proposal.evidence).toEqual([
      { text: 'Starting soon: Standup in 5 min', source: 'notice:meeting' },
      { text: 'Disk full: 5% free', source: 'notice:disk' }
    ])
  })

  it('should say so when the pile is empty', async () => {
    const capability = new CapabilityRegistry(
      triageCapabilities({
        triage: async () => ({ items: [], summary: 'Nothing needs you right now.', card: null })
      })
    ).get('triage')!
    const proposal = await capability.plan(capability.params.parse({}), ctx)
    if (proposal.kind !== 'answer') throw new Error('expected answer')
    expect(proposal.summary).toMatch(/nothing needs you/i)
    expect(proposal.evidence).toEqual([])
    expect(proposal.card).toBeUndefined()
  })
})
