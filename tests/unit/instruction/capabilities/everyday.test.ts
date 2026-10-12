import { describe, it, expect, vi } from 'vitest'
import { CapabilityRegistry } from '../../../../src/main/domain/instruction/model/CapabilityRegistry'
import {
  everydayCapabilities,
  type EverydayCapabilityDeps
} from '../../../../src/main/domain/instruction/capabilities/everyday'
import type {
  CapabilityContext,
  Proposal
} from '../../../../src/main/domain/instruction/model/Capability'

const ctx: CapabilityContext = {
  home: '/Users/test',
  projectsRoot: '/Users/test/Code',
  signal: new AbortController().signal,
  logger: { info: () => {}, warn: () => {} }
}

process.env.TZ = 'Europe/Sofia'

const NOW = new Date('2026-09-15T10:00:00.000+03:00')

function deps(overrides: Partial<EverydayCapabilityDeps> = {}): EverydayCapabilityDeps {
  return {
    now: () => NOW,
    calendarEvents: vi.fn(async () => [
      {
        title: 'Standup',
        start: '2026-09-15T09:30:00.000+03:00',
        end: '2026-09-15T09:45:00.000+03:00',
        location: null,
        calendar: 'Work',
        allDay: false
      },
      {
        title: 'Dentist',
        start: '2026-09-15T16:00:00.000+03:00',
        end: '2026-09-15T17:00:00.000+03:00',
        location: 'Sofia Dental',
        calendar: 'Home',
        allDay: false
      }
    ]),
    createReminder: vi.fn(async () => ({ id: 'rem-1' })),
    createNote: vi.fn(async () => ({ id: 'note-1' })),
    createEvent: vi.fn(async () => ({ id: 'ev-1' })),
    deleteEvent: vi.fn(async () => {}),
    saveCaptureFile: vi.fn(async () => ({ path: '/Users/test/Documents/Talyx Capture/x.md' })),
    recentFiles: vi.fn(async () => [
      {
        path: '/Users/test/Code/talyx/README.md',
        name: 'README.md',
        lastUsedAt: '2026-09-15T09:10:00.000+03:00'
      },
      {
        path: '/Users/test/Desktop/notes.txt',
        name: 'notes.txt',
        lastUsedAt: '2026-09-15T04:30:00.000+03:00'
      }
    ]),
    extractText: vi.fn(async () => ({
      text: 'Lease starts 1 October. Rent 900.',
      truncated: false
    })),
    scanFiles: vi.fn(async () => [
      {
        path: '/downloads/movie.mkv',
        name: 'movie.mkv',
        size: 3_000_000_000,
        modifiedAt: '2026-09-10T00:00:00.000Z'
      },
      {
        path: '/downloads/old.zip',
        name: 'old.zip',
        size: 50_000_000,
        modifiedAt: '2024-01-01T00:00:00.000Z'
      },
      {
        path: '/downloads/note.txt',
        name: 'note.txt',
        size: 100,
        modifiedAt: '2026-09-14T00:00:00.000Z'
      }
    ]),
    ...overrides
  }
}

async function propose(
  name: string,
  params: unknown,
  overrides: Partial<EverydayCapabilityDeps> = {}
): Promise<{ proposal: Proposal; d: EverydayCapabilityDeps }> {
  const d = deps(overrides)
  const capability = new CapabilityRegistry(everydayCapabilities(d)).get(name)!
  const proposal = await capability.plan(capability.params.parse(params), ctx)
  return { proposal, d }
}

describe('today', () => {
  it('should list the events of the day with times and attach an agenda card', async () => {
    const { proposal, d } = await propose('today', {})
    if (proposal.kind !== 'answer') throw new Error('expected answer')
    const [start, end] = (d.calendarEvents as ReturnType<typeof vi.fn>).mock.calls[0] as [
      Date,
      Date
    ]
    expect(start.toISOString()).toBe('2026-09-14T21:00:00.000Z')
    expect(end.toISOString()).toBe('2026-09-15T21:00:00.000Z')
    expect(proposal.summary).toBe('2 events today')
    expect(proposal.evidence.map((e) => e.text)).toEqual([
      '09:30–09:45 Standup',
      '16:00–17:00 Dentist · Sofia Dental'
    ])
    expect(proposal.card).toEqual({
      kind: 'agenda',
      day: 'today',
      events: [
        {
          title: 'Standup',
          start: '2026-09-15T09:30:00.000+03:00',
          end: '2026-09-15T09:45:00.000+03:00',
          location: null,
          calendar: 'Work',
          allDay: false
        },
        {
          title: 'Dentist',
          start: '2026-09-15T16:00:00.000+03:00',
          end: '2026-09-15T17:00:00.000+03:00',
          location: 'Sofia Dental',
          calendar: 'Home',
          allDay: false
        }
      ]
    })
  })

  it('should ask for tomorrow when told to', async () => {
    const { proposal, d } = await propose('today', { day: 'tomorrow' })
    const [start] = (d.calendarEvents as ReturnType<typeof vi.fn>).mock.calls[0] as [Date, Date]
    expect(start.toISOString()).toBe('2026-09-15T21:00:00.000Z')
    expect(proposal.summary).toBe('2 events tomorrow')
  })

  it('should cover the next seven days with weekday-prefixed evidence when asked for the week', async () => {
    const { proposal, d } = await propose('today', { day: 'week' })
    if (proposal.kind !== 'answer') throw new Error('expected answer')
    const [start, end] = (d.calendarEvents as ReturnType<typeof vi.fn>).mock.calls[0] as [
      Date,
      Date
    ]
    expect(start.toISOString()).toBe('2026-09-14T21:00:00.000Z')
    expect(end.toISOString()).toBe('2026-09-21T21:00:00.000Z')
    expect(proposal.summary).toBe('2 events this week')
    expect(proposal.evidence.map((e) => e.text)).toEqual([
      'Tue 15 Sep 09:30–09:45 Standup',
      'Tue 15 Sep 16:00–17:00 Dentist · Sofia Dental'
    ])
    expect(proposal.card).toMatchObject({ kind: 'agenda', day: 'week' })
  })

  it('should say when the day is free', async () => {
    const { proposal } = await propose('today', {}, { calendarEvents: async () => [] })
    if (proposal.kind !== 'answer') throw new Error('expected answer')
    expect(proposal.summary).toBe('Nothing on your calendar today')
    expect(proposal.card).toEqual({ kind: 'agenda', day: 'today', events: [] })
  })
})

describe('remind_me', () => {
  it('should propose one reminder with its time and create it on execute', async () => {
    const { proposal, d } = await propose('remind_me', {
      title: 'Call mom',
      due: '2026-09-15T18:00:00+03:00'
    })
    if (proposal.kind !== 'plan') throw new Error('expected plan')
    expect(proposal.summary).toBe('Remind you: Call mom')
    expect(proposal.operations).toHaveLength(1)
    expect(proposal.operations[0].label).toBe('Call mom · 15 Sep, 18:00')
    expect(proposal.operations[0].payload).toEqual({
      title: 'Call mom',
      due: '2026-09-15T18:00:00+03:00'
    })
    const cap = new CapabilityRegistry(everydayCapabilities(d)).get('remind_me')!
    const out = await cap.execute!(proposal.operations[0], ctx)
    expect(d.createReminder).toHaveBeenCalledWith({
      title: 'Call mom',
      due: '2026-09-15T18:00:00+03:00'
    })
    expect(out).toBe('Reminder added')
  })

  it('should accept a reminder without a time', async () => {
    const { proposal } = await propose('remind_me', { title: 'Buy filters' })
    if (proposal.kind !== 'plan') throw new Error('expected plan')
    expect(proposal.operations[0].label).toBe('Buy filters · no time')
  })

  it('should reject a due that is not a date-time', () => {
    const cap = new CapabilityRegistry(everydayCapabilities(deps())).get('remind_me')!
    expect(cap.params.safeParse({ title: 'x', due: 'tonight' }).success).toBe(false)
  })

  it('should register as a creation that cannot be undone yet', () => {
    const cap = new CapabilityRegistry(everydayCapabilities(deps())).get('remind_me')!
    expect(cap.effect).toEqual({ world: 'creates', reversible: false, discloses: 'nothing' })
  })
})

describe('take_note', () => {
  it('should propose the note and create it on execute', async () => {
    const { proposal, d } = await propose('take_note', {
      title: 'Coffee machine',
      body: 'Buy filters size 4'
    })
    if (proposal.kind !== 'plan') throw new Error('expected plan')
    expect(proposal.summary).toBe('Save a note: Coffee machine')
    expect(proposal.operations[0].label).toBe('Coffee machine — Buy filters size 4')
    const cap = new CapabilityRegistry(everydayCapabilities(d)).get('take_note')!
    expect(await cap.execute!(proposal.operations[0], ctx)).toBe('Note saved')
    expect(d.createNote).toHaveBeenCalledWith({
      title: 'Coffee machine',
      body: 'Buy filters size 4'
    })
  })

  it('should keep the label short when the body is long', async () => {
    const { proposal } = await propose('take_note', { title: 'T', body: 'x'.repeat(200) })
    if (proposal.kind !== 'plan') throw new Error('expected plan')
    expect(proposal.operations[0].label).toBe(`T — ${'x'.repeat(80)}…`)
  })
})

describe('read_document', () => {
  it('should return the text as evidence and say how long it is', async () => {
    const { proposal, d } = await propose('read_document', { path: '~/Documents/lease.pdf' })
    if (proposal.kind !== 'answer') throw new Error('expected answer')
    expect(d.extractText).toHaveBeenCalledWith('/Users/test/Documents/lease.pdf')
    expect(proposal.summary).toBe('lease.pdf — 33 characters')
    expect(proposal.evidence).toEqual([
      { source: '/Users/test/Documents/lease.pdf', text: 'Lease starts 1 October. Rent 900.' }
    ])
    expect(proposal.card).toBeUndefined()
  })

  it('should flag a truncated document', async () => {
    const { proposal } = await propose(
      'read_document',
      { path: '/a/big.pdf' },
      { extractText: async () => ({ text: 'abc', truncated: true }) }
    )
    expect(proposal.summary).toBe('big.pdf — 3 characters, cut off at the limit')
  })

  it('should say when nothing readable came out', async () => {
    const { proposal } = await propose(
      'read_document',
      { path: '/a/scan.pdf' },
      { extractText: async () => ({ text: '   ', truncated: false }) }
    )
    if (proposal.kind !== 'answer') throw new Error('expected answer')
    expect(proposal.summary).toBe('No readable text in scan.pdf')
    expect(proposal.evidence).toEqual([])
  })

  it('should disclose content and stay read-only', () => {
    const cap = new CapabilityRegistry(everydayCapabilities(deps())).get('read_document')!
    expect(cap.effect).toEqual({ world: 'reads', reversible: false, discloses: 'content' })
  })
})

describe('whats_cluttering', () => {
  it('should rank the largest and the oldest files with sizes and ages', async () => {
    const { proposal, d } = await propose('whats_cluttering', { folder: '/downloads' })
    if (proposal.kind !== 'answer') throw new Error('expected answer')
    expect(d.scanFiles).toHaveBeenCalledWith('/downloads')
    expect(proposal.summary).toBe('downloads: 3 files, 2.8 GB — the largest 3 hold 2.8 GB')
    expect(proposal.evidence.map((e) => e.text)).toEqual([
      'movie.mkv · 2.8 GB · 5 days old',
      'old.zip · 47.7 MB · 2 years old',
      'note.txt · 100 B · 1 day old'
    ])
    expect(proposal.card).toEqual({
      kind: 'paths',
      entries: [
        {
          path: '/downloads/movie.mkv',
          label: 'movie.mkv',
          snippet: '2.8 GB · 5 days old',
          isDirectory: false
        },
        {
          path: '/downloads/old.zip',
          label: 'old.zip',
          snippet: '47.7 MB · 2 years old',
          isDirectory: false
        },
        {
          path: '/downloads/note.txt',
          label: 'note.txt',
          snippet: '100 B · 1 day old',
          isDirectory: false
        }
      ]
    })
  })

  it('should say when the folder is tidy', async () => {
    const { proposal } = await propose(
      'whats_cluttering',
      { folder: '/downloads' },
      { scanFiles: async () => [] }
    )
    expect(proposal.summary).toBe('downloads is empty')
  })
})

describe('create_event', () => {
  it('should propose one event with its time and create it on execute', async () => {
    const { proposal, d } = await propose('create_event', {
      title: 'Dentist',
      start: '2026-09-16T16:00:00+03:00'
    })
    if (proposal.kind !== 'plan') throw new Error('expected plan')
    expect(proposal.summary).toBe('Add to your calendar: Dentist')
    expect(proposal.operations).toHaveLength(1)
    expect(proposal.operations[0].label).toBe('Dentist · 16 Sep, 16:00–17:00')
    expect(proposal.operations[0].payload).toEqual({
      title: 'Dentist',
      start: '2026-09-16T16:00:00+03:00',
      end: '2026-09-16T14:00:00.000Z',
      location: null,
      calendar: null
    })
    const cap = new CapabilityRegistry(everydayCapabilities(d)).get('create_event')!
    expect(await cap.execute!(proposal.operations[0], ctx)).toBe('Event added')
    expect(d.createEvent).toHaveBeenCalledWith({
      title: 'Dentist',
      start: '2026-09-16T16:00:00+03:00',
      end: '2026-09-16T14:00:00.000Z',
      location: null,
      calendar: null
    })
  })

  it('should honour a duration, a location and a named calendar', async () => {
    const { proposal } = await propose('create_event', {
      title: 'Standup',
      start: '2026-09-16T09:30:00+03:00',
      durationMinutes: 15,
      location: 'Zoom',
      calendar: 'Work'
    })
    if (proposal.kind !== 'plan') throw new Error('expected plan')
    expect(proposal.operations[0].label).toBe('Standup · 16 Sep, 09:30–09:45 · Zoom')
    expect(proposal.operations[0].payload).toMatchObject({
      end: '2026-09-16T06:45:00.000Z',
      location: 'Zoom',
      calendar: 'Work'
    })
  })

  it('should learn the event id on execute so undo can delete it', async () => {
    const { proposal, d } = await propose('create_event', {
      title: 'Dentist',
      start: '2026-09-16T16:00:00+03:00'
    })
    if (proposal.kind !== 'plan') throw new Error('expected plan')
    const op = proposal.operations[0]
    expect(op.inverse).toBeNull()
    const cap = new CapabilityRegistry(everydayCapabilities(d)).get('create_event')!
    await cap.execute!(op, ctx)
    expect(op.inverse).toEqual({ eventId: 'ev-1' })
    await cap.revert!(op, ctx)
    expect(d.deleteEvent).toHaveBeenCalledWith('ev-1')
  })

  it('should reject a start that is not a date-time', () => {
    const cap = new CapabilityRegistry(everydayCapabilities(deps())).get('create_event')!
    expect(cap.params.safeParse({ title: 'x', start: 'next tuesday' }).success).toBe(false)
  })

  it('should register as a creation that can be undone', () => {
    const cap = new CapabilityRegistry(everydayCapabilities(deps())).get('create_event')!
    expect(cap.effect).toEqual({ world: 'creates', reversible: true, discloses: 'nothing' })
  })
})

describe('what_did_i_do', () => {
  const standupOnly = (): Partial<EverydayCapabilityDeps> => ({
    calendarEvents: vi.fn(async () => [
      {
        title: 'Standup',
        start: '2026-09-15T09:30:00.000+03:00',
        end: '2026-09-15T09:45:00.000+03:00',
        location: null,
        calendar: 'Work',
        allDay: false
      }
    ])
  })

  it('should combine the meetings and the files of the morning', async () => {
    const { proposal, d } = await propose('what_did_i_do', { window: 'morning' }, standupOnly())
    if (proposal.kind !== 'answer') throw new Error('expected answer')
    const [from, to] = (d.calendarEvents as ReturnType<typeof vi.fn>).mock.calls[0] as [Date, Date]
    expect(from.toISOString()).toBe('2026-09-15T02:00:00.000Z')
    expect(to.toISOString()).toBe('2026-09-15T07:00:00.000Z')
    expect(proposal.summary).toBe('This morning: 1 meeting, 1 file')
    expect(proposal.evidence.map((e) => e.text)).toEqual([
      '09:30–09:45 Standup',
      'README.md · 09:10'
    ])
    expect(proposal.card).toEqual({
      kind: 'paths',
      entries: [
        {
          path: '/Users/test/Code/talyx/README.md',
          label: 'README.md',
          snippet: '09:10',
          isDirectory: false
        }
      ]
    })
  })

  it('should drop the files used outside the window', async () => {
    const { proposal } = await propose('what_did_i_do', { window: 'morning' }, standupOnly())
    if (proposal.kind !== 'answer') throw new Error('expected answer')
    expect(proposal.evidence.map((e) => e.source)).not.toContain('/Users/test/Desktop/notes.txt')
  })

  it('should stop the morning at midday once the day has moved on', async () => {
    const { proposal, d } = await propose(
      'what_did_i_do',
      {
        window: 'morning'
      },
      { ...standupOnly(), now: () => new Date('2026-09-15T18:00:00.000+03:00') }
    )
    const [from, to] = (d.calendarEvents as ReturnType<typeof vi.fn>).mock.calls[0] as [Date, Date]
    expect(from.toISOString()).toBe('2026-09-15T02:00:00.000Z')
    expect(to.toISOString()).toBe('2026-09-15T09:00:00.000Z')
    expect(proposal.summary).toBe('This morning: 1 meeting, 1 file')
  })

  it('should look at the whole of yesterday when asked', async () => {
    const { proposal, d } = await propose(
      'what_did_i_do',
      { window: 'yesterday' },
      { calendarEvents: vi.fn(async () => []) }
    )
    const [from, to] = (d.calendarEvents as ReturnType<typeof vi.fn>).mock.calls[0] as [Date, Date]
    expect(from.toISOString()).toBe('2026-09-13T21:00:00.000Z')
    expect(to.toISOString()).toBe('2026-09-14T21:00:00.000Z')
    expect(proposal.summary).toBe('Yesterday: no meetings, no files')
  })

  it('should count many of each', async () => {
    const { proposal } = await propose('what_did_i_do', { window: 'today' })
    expect(proposal.summary).toBe('Today: 2 meetings, 2 files')
  })

  it('should say when nothing happened', async () => {
    const { proposal } = await propose(
      'what_did_i_do',
      { window: 'today' },
      { calendarEvents: async () => [], recentFiles: async () => [] }
    )
    if (proposal.kind !== 'answer') throw new Error('expected answer')
    expect(proposal.summary).toBe('Today: no meetings, no files')
    expect(proposal.evidence).toEqual([])
    expect(proposal.card).toBeUndefined()
  })

  it('should look past the files of today when the window already closed', async () => {
    const yesterdayFile = {
      path: '/Users/test/Documents/report.docx',
      name: 'report.docx',
      lastUsedAt: '2026-09-14T15:00:00.000+03:00'
    }
    const todayFiles = Array.from({ length: 30 }, (_, i) => ({
      path: `/Users/test/today-${i}.txt`,
      name: `today-${i}.txt`,
      lastUsedAt: '2026-09-15T09:00:00.000+03:00'
    }))
    const { proposal, d } = await propose(
      'what_did_i_do',
      { window: 'yesterday' },
      {
        calendarEvents: vi.fn(async () => []),
        recentFiles: vi.fn(async (_hours, limit) => [...todayFiles, yesterdayFile].slice(0, limit))
      }
    )
    const [, limit] = (d.recentFiles as ReturnType<typeof vi.fn>).mock.calls[0] as [number, number]
    expect(limit).toBeGreaterThan(30)
    expect(proposal.summary).toBe('Yesterday: no meetings, 1 file')
  })

  it('should cap how many files it lists however many come back', async () => {
    const many = Array.from({ length: 50 }, (_, i) => ({
      path: `/Users/test/f-${i}.txt`,
      name: `f-${i}.txt`,
      lastUsedAt: '2026-09-15T09:00:00.000+03:00'
    }))
    const { proposal } = await propose(
      'what_did_i_do',
      { window: 'today' },
      { calendarEvents: vi.fn(async () => []), recentFiles: vi.fn(async () => many) }
    )
    if (proposal.kind !== 'answer') throw new Error('expected answer')
    expect(proposal.evidence).toHaveLength(20)
  })

  it('should treat the small hours as the day so far, not a backwards window', async () => {
    const { proposal, d } = await propose(
      'what_did_i_do',
      { window: 'morning' },
      {
        ...standupOnly(),
        now: () => new Date('2026-09-15T03:00:00.000+03:00')
      }
    )
    const [from, to] = (d.calendarEvents as ReturnType<typeof vi.fn>).mock.calls[0] as [Date, Date]
    expect(from.getTime()).toBeLessThanOrEqual(to.getTime())
    expect(from.toISOString()).toBe('2026-09-14T21:00:00.000Z')
    expect(to.toISOString()).toBe('2026-09-15T00:00:00.000Z')
    expect(proposal.summary).toBe('This morning: 1 meeting, no files')
  })

  it('should stay a read', () => {
    const cap = new CapabilityRegistry(everydayCapabilities(deps())).get('what_did_i_do')!
    expect(cap.effect).toEqual({ world: 'reads', reversible: false, discloses: 'nothing' })
  })
})

describe('remind_me as a timer', () => {
  it('should offer itself for timers so the model does not look for another ability', () => {
    const cap = new CapabilityRegistry(everydayCapabilities(deps())).get('remind_me')!
    expect(`${cap.description} ${cap.examples.join(' ')}`.toLowerCase()).toContain('timer')
  })
})
