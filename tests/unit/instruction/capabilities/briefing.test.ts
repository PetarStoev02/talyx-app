import { describe, it, expect, vi } from 'vitest'
import { CapabilityRegistry } from '../../../../src/main/domain/instruction/model/CapabilityRegistry'
import { briefingCapabilities } from '../../../../src/main/domain/instruction/capabilities/briefing'
import type { CapabilityContext } from '../../../../src/main/domain/instruction/model/Capability'
import type { Notice } from '../../../../src/main/domain/briefing/model/Notice'

const ctx: CapabilityContext = {
  home: '/Users/test',
  projectsRoot: '/Users/test/Code',
  signal: new AbortController().signal,
  logger: { info: () => {}, warn: () => {} }
}

const NOTICE: Notice = {
  kind: 'briefing',
  fingerprint: '2026-09-19',
  title: 'Good morning',
  body: '2 events today',
  detail: '**Good morning.**\n\n- 2 events today',
  cards: [{ kind: 'agenda', day: 'today', events: [] }]
}

function registry(compose: () => Promise<Notice | null>): CapabilityRegistry {
  return new CapabilityRegistry(briefingCapabilities({ compose }))
}

describe('brief_me', () => {
  it('should be registered as an ability the model can name', () => {
    expect(registry(async () => NOTICE).names()).toEqual(['brief_me'])
  })

  it('should answer with the briefing and the day ahead', async () => {
    const capability = registry(async () => NOTICE).get('brief_me')!

    const proposal = await capability.plan(capability.params.parse({}), ctx)

    expect(proposal.kind).toBe('answer')
    expect(proposal).toMatchObject({ summary: NOTICE.detail, card: NOTICE.cards[0] })
  })

  it('should say so plainly when there is nothing to report', async () => {
    const capability = registry(async () => null).get('brief_me')!

    const proposal = await capability.plan(capability.params.parse({}), ctx)

    expect(proposal).toEqual({
      kind: 'answer',
      summary: 'Nothing to report this morning',
      evidence: []
    })
  })

  it('should never change anything', () => {
    const capability = registry(async () => NOTICE).get('brief_me')!

    expect(capability.effect).toEqual({ world: 'reads', reversible: false, discloses: 'nothing' })
    expect(capability.execute).toBeUndefined()
  })

  it('should take no parameters the model could get wrong', async () => {
    const capability = registry(async () => NOTICE).get('brief_me')!
    const compose = vi.fn(async () => NOTICE)

    await registry(compose).get('brief_me')!.plan(capability.params.parse({}), ctx)

    expect(compose).toHaveBeenCalledOnce()
  })
})
