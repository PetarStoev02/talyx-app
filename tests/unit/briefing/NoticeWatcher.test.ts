import { describe, it, expect, vi } from 'vitest'
import { NoticeWatcher } from '../../../src/main/domain/briefing/services/NoticeWatcher'
import type { ReadCapability } from '../../../src/main/domain/briefing/services/readCapability'
import type { CalendarEvent, Proposal } from '../../../src/main/domain/instruction/model/Capability'
import { NOTICE_KINDS, type NoticeKind } from '../../../src/main/domain/briefing/model/Notice'

/** How many times this watcher has spawned the calendar script. */
function calendarReads(watcher: NoticeWatcher): number {
  const read = (watcher as unknown as { deps: { read: ReturnType<typeof vi.fn> } }).deps.read
  return read.mock.calls.filter(([name]) => name === 'today').length
}

process.env.TZ = 'Europe/Sofia'

const NOW = new Date('2026-09-19T09:00:00.000+03:00')
const DOWNLOADS = '/Users/test/Downloads'

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    title: 'Standup',
    start: '2026-09-19T14:00:00.000+03:00',
    end: '2026-09-19T14:20:00.000+03:00',
    location: 'Meeting room',
    calendar: 'Work',
    allDay: false,
    hasNotes: true,
    ...overrides
  }
}

function agenda(events: CalendarEvent[]): Proposal {
  return {
    kind: 'answer',
    summary: `${events.length} events today`,
    evidence: [],
    card: { kind: 'agenda', day: 'today', events }
  }
}

function disk(freeBytes: number, totalBytes: number): Proposal {
  return {
    kind: 'answer',
    summary: 'disk',
    evidence: [],
    card: { kind: 'disk', freeBytes, totalBytes }
  }
}

interface WatcherOptions {
  events?: CalendarEvent[]
  freeRatio?: number
  looseFiles?: number
  marks?: Record<string, string>
  downloadsUnreadable?: boolean
}

function watcherFor(options: WatcherOptions = {}): NoticeWatcher {
  const { events = [event()], freeRatio = 0.5, looseFiles = 3 } = options
  const read: ReadCapability = vi.fn(async (name) =>
    name === 'today' ? agenda(events) : name === 'disk_space' ? disk(freeRatio * 100, 100) : null
  )
  return new NoticeWatcher({
    read,
    now: () => NOW,
    countLooseFiles: vi.fn(async () => {
      if (options.downloadsUnreadable) throw new Error('EPERM: operation not permitted')
      return looseFiles
    }),
    downloadsPath: DOWNLOADS,
    warn: () => {}
  })
}

async function check(
  kinds: NoticeKind[],
  options: WatcherOptions = {}
): Promise<ReturnType<NoticeWatcher['check']>> {
  return watcherFor(options).check({ kinds, marks: options.marks ?? {} })
}

describe('NoticeWatcher', () => {
  it('should stay silent when nothing is worth interrupting for', async () => {
    expect(await check([...NOTICE_KINDS])).toEqual([])
  })

  it('should warn that the disk is nearly full', async () => {
    const notices = await check(['disk'], { freeRatio: 0.06 })

    expect(notices).toHaveLength(1)
    expect(notices[0].kind).toBe('disk')
    expect(notices[0].fingerprint).toBe('2026-09-19')
    expect(notices[0].cards[0].kind).toBe('disk')
  })

  it('should leave the disk alone while there is room', async () => {
    expect(await check(['disk'], { freeRatio: 0.11 })).toEqual([])
  })

  it('should say a meeting is about to start', async () => {
    const soon = event({ start: '2026-09-19T09:05:00.000+03:00' })

    const notices = await check(['meeting'], { events: [soon] })

    expect(notices).toHaveLength(1)
    expect(notices[0].body).toContain('Standup')
    expect(notices[0].fingerprint).toBe('2026-09-19T09:05:00.000+03:00')
  })

  it('should not mention a meeting that is still an hour away', async () => {
    const soon = event({ start: '2026-09-19T10:00:00.000+03:00' })

    expect(await check(['meeting'], { events: [soon] })).toEqual([])
  })

  it('should not mention a meeting that already started', async () => {
    const started = event({ start: '2026-09-19T08:55:00.000+03:00' })

    expect(await check(['meeting'], { events: [started] })).toEqual([])
  })

  it('should flag an empty meeting an hour ahead, while there is time to fix it', async () => {
    const bare = event({
      title: '3pm sync',
      start: '2026-09-19T09:45:00.000+03:00',
      location: null,
      hasNotes: false
    })

    const notices = await check(['agenda'], { events: [bare] })

    expect(notices).toHaveLength(1)
    expect(notices[0].kind).toBe('agenda')
    expect(notices[0].body).toContain('3pm sync')
  })

  it('should not also complain about the agenda of a meeting starting in minutes', async () => {
    const bare = event({ start: '2026-09-19T09:05:00.000+03:00', location: null, hasNotes: false })

    const notices = await check(['meeting', 'agenda'], { events: [bare] })

    expect(notices.map((n) => n.kind)).toEqual(['meeting'])
  })

  it('should leave a meeting that has notes alone', async () => {
    const prepared = event({ start: '2026-09-19T09:45:00.000+03:00', hasNotes: true })

    expect(await check(['agenda'], { events: [prepared] })).toEqual([])
  })

  it('should leave a meeting that at least says where it is alone', async () => {
    const located = event({
      start: '2026-09-19T09:45:00.000+03:00',
      hasNotes: false,
      location: 'Meeting room'
    })

    expect(await check(['agenda'], { events: [located] })).toEqual([])
  })

  it('should say when downloads has piled up', async () => {
    const notices = await check(['clutter'], { looseFiles: 143 })

    expect(notices).toHaveLength(1)
    expect(notices[0].body).toContain('143')
  })

  it('should leave a tidy downloads folder alone', async () => {
    expect(await check(['clutter'], { looseFiles: 99 })).toEqual([])
  })

  it('should not repeat a daily notice already delivered today', async () => {
    const notices = await check(['disk', 'clutter'], {
      freeRatio: 0.01,
      looseFiles: 900,
      marks: { disk: '2026-09-19', clutter: '2026-09-19' }
    })

    expect(notices).toEqual([])
  })

  it('should still warn about the disk when downloads cannot be read at all', async () => {
    const notices = await check(['disk', 'clutter'], {
      freeRatio: 0.02,
      downloadsUnreadable: true
    })

    expect(notices.map((n) => n.kind)).toEqual(['disk'])
  })

  it('should ask the calendar once, not once per notice kind', async () => {
    const soon = event({ start: '2026-09-19T09:05:00.000+03:00' })
    const watcher = watcherFor({ events: [soon] })

    await watcher.check({ kinds: ['meeting', 'agenda'], marks: {} })
    await watcher.check({ kinds: ['meeting', 'agenda'], marks: {} })

    expect(calendarReads(watcher)).toBe(1)
  })

  it('should only check the kinds it was asked about', async () => {
    const notices = await check(['disk'], { freeRatio: 0.01, looseFiles: 900 })

    expect(notices.map((n) => n.kind)).toEqual(['disk'])
  })
})
