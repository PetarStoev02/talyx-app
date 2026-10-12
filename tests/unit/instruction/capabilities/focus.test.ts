import { describe, it, expect, vi } from 'vitest'
import { CapabilityRegistry } from '../../../../src/main/domain/instruction/model/CapabilityRegistry'
import {
  focusCapabilities,
  RELATED_LIMIT,
  type FocusDeps,
  type FocusInverse,
  type FocusPayload
} from '../../../../src/main/domain/instruction/capabilities/focus'
import type {
  CalendarEvent,
  Capability,
  CapabilityContext
} from '../../../../src/main/domain/instruction/model/Capability'

const ctx: CapabilityContext = {
  home: '/Users/test',
  projectsRoot: '/Users/test/Code',
  signal: new AbortController().signal,
  logger: { info: () => {}, warn: () => {} }
}

/** Local clock: 10:00 on 2026-09-28. */
const NOW = new Date(2026, 8, 28, 10, 0)
const at = (hour: number): string => new Date(2026, 8, 28, hour, 0).toISOString()

function event(title: string, startHour: number, endHour: number, allDay = false): CalendarEvent {
  return {
    title,
    start: at(startHour),
    end: at(endHour),
    location: null,
    calendar: 'Work',
    allDay,
    hasNotes: false
  }
}

function deps(overrides: Partial<FocusDeps> = {}): FocusDeps {
  return {
    now: () => NOW,
    calendarEvents: vi.fn(async () => [
      event('Company day', 0, 24, true),
      event('Standup', 8, 9),
      event('Design review', 11, 12),
      event('1:1 with Ana', 14, 15)
    ]),
    recall: vi.fn(async () => [
      {
        kind: 'file',
        path: '/Users/test/Docs/design-review.pdf',
        name: 'design-review.pdf',
        snippet: '',
        rank: 1
      },
      {
        kind: 'conversation',
        id: 'c1',
        title: 'Design review prep',
        snippet: '',
        updatedAt: 1,
        rank: 0.5
      }
    ]),
    pausedUntil: () => null,
    setPausedUntil: vi.fn(),
    ...overrides
  }
}

function focus(d: FocusDeps): Capability {
  return new CapabilityRegistry(focusCapabilities(d)).get('focus')!
}

describe('focus', () => {
  it('should quiet Talyx until the next timed meeting ends and take that back on undo', async () => {
    const d = deps()
    const cap = focus(d)
    expect(cap.effect).toEqual({ world: 'mutates', reversible: true, discloses: 'query' })

    const proposal = await cap.plan(cap.params.parse({}), ctx)
    if (proposal.kind !== 'plan') throw new Error('expected a plan')
    expect(proposal.summary).toBe('Focus on “Design review” until 12:00 · 2 related')
    expect(proposal.operations[0].label).toBe('Quiet until 12:00 — Design review')
    expect((proposal.operations[0].payload as FocusPayload).until).toBe(at(12))
    expect((proposal.operations[0].inverse as FocusInverse).pausedUntil).toBeNull()
    expect(d.recall).toHaveBeenCalledWith('Design review', RELATED_LIMIT)

    const output = await cap.execute!(proposal.operations[0], ctx)
    expect(d.setPausedUntil).toHaveBeenCalledWith(at(12))
    expect(output).toBe(
      [
        'Quiet until 12:00 · 11:00–12:00 Design review',
        'Related:',
        '- /Users/test/Docs/design-review.pdf',
        '- chat: Design review prep'
      ].join('\n')
    )

    await cap.revert!(proposal.operations[0], ctx)
    expect(d.setPausedUntil).toHaveBeenLastCalledWith(null)
  })

  it('should pick the meeting running right now over the one after it', async () => {
    const cap = focus(
      deps({ calendarEvents: vi.fn(async () => [event('Standup', 9, 11), event('Later', 13, 14)]) })
    )
    const proposal = await cap.plan({}, ctx)
    if (proposal.kind !== 'plan') throw new Error('expected a plan')
    expect(proposal.operations[0].label).toBe('Quiet until 11:00 — Standup')
  })

  it('should not cut short a day pause that already runs past the meeting, and put it back on undo', async () => {
    const tomorrow = new Date(2026, 8, 29).toISOString()
    const d = deps({ pausedUntil: () => tomorrow })
    const cap = focus(d)
    const proposal = await cap.plan({}, ctx)
    if (proposal.kind !== 'plan') throw new Error('expected a plan')
    expect(proposal.operations[0].label).toBe('Quiet until 00:00 — Design review')
    await cap.execute!(proposal.operations[0], ctx)
    expect(d.setPausedUntil).toHaveBeenCalledWith(tomorrow)
    await cap.revert!(proposal.operations[0], ctx)
    expect(d.setPausedUntil).toHaveBeenLastCalledWith(tomorrow)
  })

  it('should say so when no timed meeting is left today', async () => {
    const d = deps({
      calendarEvents: vi.fn(async () => [event('Standup', 8, 9), event('Day', 0, 24, true)])
    })
    const proposal = await focus(d).plan({}, ctx)
    expect(proposal).toEqual({
      kind: 'answer',
      summary: 'No more meetings today — nothing to focus on',
      evidence: []
    })
    expect(d.recall).not.toHaveBeenCalled()
  })

  it.each([
    ['nothing relates', vi.fn(async () => [])],
    ['the search fails', vi.fn(async () => Promise.reject(new Error('index locked')))]
  ])('should still quiet Talyx when %s', async (_case, recall) => {
    const cap = focus(deps({ recall }))
    const proposal = await cap.plan({}, ctx)
    if (proposal.kind !== 'plan') throw new Error('expected a plan')
    expect(proposal.summary).toBe('Focus on “Design review” until 12:00')
    expect(await cap.execute!(proposal.operations[0], ctx)).toBe(
      'Quiet until 12:00 · 11:00–12:00 Design review'
    )
  })
})
