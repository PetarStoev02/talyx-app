import { describe, it, expect, vi } from 'vitest'
import { BriefingService } from '../../../src/main/domain/briefing/services/BriefingService'
import type { ReadCapability } from '../../../src/main/domain/briefing/services/readCapability'
import type { Proposal } from '../../../src/main/domain/instruction/model/Capability'

process.env.TZ = 'Europe/Sofia'

const NOW = new Date('2026-09-19T08:00:00.000+03:00')

const AGENDA: Proposal = {
  kind: 'answer',
  summary: '2 events today',
  evidence: [],
  card: {
    kind: 'agenda',
    day: 'today',
    events: [
      {
        title: 'Standup',
        start: '2026-09-19T09:30:00.000+03:00',
        end: '2026-09-19T09:45:00.000+03:00',
        location: null,
        calendar: 'Work',
        allDay: false,
        hasNotes: false
      }
    ]
  }
}

const MAIL: Proposal = {
  kind: 'answer',
  summary: '12 unread messages',
  evidence: [],
  card: { kind: 'mail', messages: [] }
}

const DISK: Proposal = {
  kind: 'answer',
  summary: '40 GB free of 500 GB',
  evidence: [],
  card: { kind: 'disk', freeBytes: 40, totalBytes: 500 }
}

const RECAP: Proposal = { kind: 'answer', summary: '3 files, 1 meeting yesterday', evidence: [] }

const ANSWERS: Record<string, Proposal> = {
  today: AGENDA,
  unread_mail: MAIL,
  disk_space: DISK,
  what_did_i_do: RECAP
}

function service(read: ReadCapability): BriefingService {
  return new BriefingService({ read, now: () => NOW })
}

describe('BriefingService', () => {
  it('should gather the day into one notice carrying every capability summary', async () => {
    const read: ReadCapability = vi.fn(async (name) => ANSWERS[name] ?? null)

    const notice = await service(read).compose()

    expect(notice).not.toBeNull()
    expect(notice!.kind).toBe('briefing')
    expect(notice!.detail).toContain('2 events today')
    expect(notice!.detail).toContain('12 unread messages')
    expect(notice!.detail).toContain('40 GB free of 500 GB')
    expect(notice!.detail).toContain('3 files, 1 meeting yesterday')
  })

  it('should show the day, the inbox and the disk as cards', async () => {
    const read: ReadCapability = vi.fn(async (name) => ANSWERS[name] ?? null)

    const notice = await service(read).compose()

    expect(notice!.cards.map((c) => c.kind)).toEqual(['agenda', 'mail', 'disk'])
  })

  it('should fingerprint the briefing with the day so a relaunch does not repeat it', async () => {
    const read: ReadCapability = vi.fn(async (name) => ANSWERS[name] ?? null)

    const notice = await service(read).compose()

    expect(notice!.fingerprint).toBe('2026-09-19')
  })

  it('should recap yesterday rather than this morning', async () => {
    const read: ReadCapability = vi.fn(async (name) => ANSWERS[name] ?? null)

    await service(read).compose()

    expect(read).toHaveBeenCalledWith('what_did_i_do', { window: 'yesterday' })
  })

  it('should still brief when one ability could not answer', async () => {
    const read: ReadCapability = vi.fn(async (name) =>
      name === 'unread_mail' ? null : (ANSWERS[name] ?? null)
    )

    const notice = await service(read).compose()

    expect(notice!.detail).toContain('2 events today')
    expect(notice!.detail).not.toContain('unread')
  })

  it('should say nothing at all when no ability could answer', async () => {
    const notice = await service(async () => null).compose()

    expect(notice).toBeNull()
  })

  it('should ask one ability at a time, so two scripts never fight for the same app', async () => {
    let running = 0
    let overlapped = false
    const read: ReadCapability = vi.fn(async (name) => {
      running += 1
      if (running > 1) overlapped = true
      await new Promise((resolve) => setTimeout(resolve, 1))
      running -= 1
      return ANSWERS[name] ?? null
    })

    await service(read).compose()

    expect(overlapped).toBe(false)
    expect(read).toHaveBeenCalledTimes(4)
  })

  it('should put the headline numbers in the notification body', async () => {
    const read: ReadCapability = vi.fn(async (name) => ANSWERS[name] ?? null)

    const notice = await service(read).compose()

    expect(notice!.body).toBe('2 events today · 12 unread messages · 40 GB free of 500 GB')
  })
})
