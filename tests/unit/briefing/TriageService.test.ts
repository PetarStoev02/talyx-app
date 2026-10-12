import { describe, it, expect, vi } from 'vitest'
import { TriageService } from '../../../src/main/domain/briefing/services/TriageService'
import type { NoticeWatcher } from '../../../src/main/domain/briefing/services/NoticeWatcher'
import type { Notice } from '../../../src/main/domain/briefing/model/Notice'

function notice(partial: Partial<Notice> & Pick<Notice, 'kind' | 'title' | 'body'>): Notice {
  return {
    fingerprint: 'fp',
    detail: partial.body,
    cards: partial.cards ?? [],
    ...partial
  }
}

function watcherReturning(notices: Notice[]): {
  watcher: NoticeWatcher
  check: ReturnType<typeof vi.fn>
} {
  const check = vi.fn(async () => notices)
  return {
    watcher: { check } as unknown as NoticeWatcher,
    check
  }
}

describe('TriageService', () => {
  it('should ask the watcher for on-demand kinds with empty delivery marks', async () => {
    const { watcher, check } = watcherReturning([])
    await new TriageService(watcher).triage()
    expect(check).toHaveBeenCalledWith({
      kinds: ['meeting', 'agenda', 'disk', 'clutter'],
      marks: {}
    })
  })

  it('should return an empty pile when nothing is live', async () => {
    const { watcher } = watcherReturning([])
    const result = await new TriageService(watcher).triage()
    expect(result.items).toEqual([])
    expect(result.summary).toMatch(/nothing needs you/i)
  })

  it('should rank a meeting ahead of disk', async () => {
    const { watcher } = watcherReturning([
      notice({ kind: 'disk', title: 'Disk full', body: '5% free' }),
      notice({ kind: 'meeting', title: 'Starting soon', body: 'Standup in 5 min' })
    ])
    const result = await new TriageService(watcher).triage()
    expect(result.items.map((i) => i.kind)).toEqual(['meeting', 'disk'])
    expect(result.items[0].rank).toBeLessThan(result.items[1].rank)
    expect(result.summary).toContain('Starting soon')
    expect(result.summary).toContain('Disk full')
  })

  it('should order meeting, agenda, disk, clutter', async () => {
    const { watcher } = watcherReturning([
      notice({ kind: 'clutter', title: 'Downloads', body: '120 files' }),
      notice({ kind: 'agenda', title: 'No agenda', body: '1:1 bare' }),
      notice({ kind: 'disk', title: 'Disk', body: 'low' }),
      notice({ kind: 'meeting', title: 'Soon', body: 'now' })
    ])
    const result = await new TriageService(watcher).triage()
    expect(result.items.map((i) => i.kind)).toEqual(['meeting', 'agenda', 'disk', 'clutter'])
  })

  it('should surface the top item card when present', async () => {
    const agendaCard = {
      kind: 'agenda' as const,
      day: 'today' as const,
      events: []
    }
    const { watcher } = watcherReturning([
      notice({
        kind: 'meeting',
        title: 'Starting soon',
        body: 'Standup in 5 min',
        cards: [agendaCard]
      }),
      notice({ kind: 'disk', title: 'Disk full', body: '5% free' })
    ])
    const result = await new TriageService(watcher).triage()
    expect(result.card).toEqual(agendaCard)
    expect(result.items[0].card).toEqual(agendaCard)
  })

  it('should ignore briefing notices if they appear', async () => {
    const { watcher } = watcherReturning([
      notice({ kind: 'briefing', title: 'Morning', body: 'day ahead' }),
      notice({ kind: 'disk', title: 'Disk', body: 'low' })
    ])
    const result = await new TriageService(watcher).triage()
    expect(result.items.map((i) => i.kind)).toEqual(['disk'])
    expect(result.card).toBeNull()
  })
})
