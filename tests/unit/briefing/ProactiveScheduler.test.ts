import { describe, it, expect, vi } from 'vitest'
import {
  ProactiveScheduler,
  type NoticeSettings
} from '../../../src/main/domain/briefing/services/ProactiveScheduler'
import type { Notice } from '../../../src/main/domain/briefing/model/Notice'

process.env.TZ = 'Europe/Sofia'

const BRIEFING: Notice = {
  kind: 'briefing',
  fingerprint: '2026-09-19',
  title: 'Good morning',
  body: '2 events today',
  detail: 'morning',
  cards: []
}

const DISK: Notice = {
  kind: 'disk',
  fingerprint: '2026-09-19',
  title: 'Your disk is nearly full',
  body: '6% free',
  detail: 'disk',
  cards: []
}

const MEETING: Notice = {
  kind: 'meeting',
  fingerprint: '2026-09-19T10:00',
  title: 'Standup in 15 minutes',
  body: 'Daily sync',
  detail: 'meeting',
  cards: []
}

const ALL_ON: NoticeSettings = {
  noticesEnabled: true,
  briefingTime: '08:00',
  briefingStyle: 'facts',
  noticeKinds: { briefing: true, disk: true, meeting: true, agenda: true, clutter: true }
}

interface Harness {
  scheduler: ProactiveScheduler
  delivered: Notice[]
  marks: Record<string, string>
  written: Record<string, string>[]
  spoken: string[]
  pausedUntil: string | null
  pauseWrites: (string | null)[]
}

function harness(options: {
  at: string
  settings?: Partial<NoticeSettings>
  marks?: Record<string, string>
  pausedUntil?: string | null
  busy?: boolean
  briefing?: Notice | null
  notices?: Notice[]
  speakFails?: boolean
  deliverFails?: boolean
  composeThrows?: boolean
  checkThrows?: boolean
  onSpeak?: () => void
  busyAfterSpeak?: () => boolean
}): Harness {
  const delivered: Notice[] = []
  const written: Record<string, string>[] = []
  const spoken: string[] = []
  const marks = options.marks ?? {}
  let pausedUntil = options.pausedUntil ?? null
  const pauseWrites: (string | null)[] = []
  const scheduler = new ProactiveScheduler({
    now: () => new Date(options.at),
    settings: () => ({ ...ALL_ON, pausedUntil, ...options.settings }),
    marks: () => marks,
    saveMarks: (next) => {
      written.push(next)
      for (const [kind, fingerprint] of Object.entries(next)) marks[kind] = fingerprint
    },
    pausedUntil: () => pausedUntil,
    savePausedUntil: (value) => {
      pauseWrites.push(value)
      pausedUntil = value
    },
    briefing: {
      compose: vi.fn(async () => {
        if (options.composeThrows) throw new Error('Calendar is not answering')
        return 'briefing' in options ? options.briefing! : BRIEFING
      })
    },
    watcher: {
      check: vi.fn(async () => {
        if (options.checkThrows) throw new Error('Calendar is not answering')
        return options.notices ?? []
      })
    },
    deliver: async (notice) => {
      if (options.deliverFails) throw new Error('Notification Centre said no')
      delivered.push(notice)
    },
    speak: async (instruction) => {
      if (options.speakFails) throw new Error('No Claude is connected')
      spoken.push(instruction)
      options.onSpeak?.()
    },
    busy: () => options.busyAfterSpeak?.() ?? options.busy ?? false,
    warn: () => {}
  })
  return { scheduler, delivered, marks, written, spoken, pausedUntil, pauseWrites }
}

describe('ProactiveScheduler', () => {
  it('should brief once the chosen time has passed', async () => {
    const h = harness({ at: '2026-09-19T08:00:00.000+03:00' })

    await h.scheduler.tick()

    expect(h.delivered.map((n) => n.kind)).toEqual(['briefing'])
  })

  it('should stay quiet before the chosen time', async () => {
    const h = harness({ at: '2026-09-19T07:59:00.000+03:00' })

    await h.scheduler.tick()

    expect(h.delivered).toEqual([])
  })

  it('should brief a Mac that only woke at nine', async () => {
    const h = harness({ at: '2026-09-19T09:00:00.000+03:00' })

    await h.scheduler.tick()

    expect(h.delivered.map((n) => n.kind)).toEqual(['briefing'])
  })

  it('should honour an afternoon briefing time', async () => {
    const h = harness({ at: '2026-09-19T14:00:00.000+03:00', settings: { briefingTime: '14:00' } })

    await h.scheduler.tick()

    expect(h.delivered.map((n) => n.kind)).toEqual(['briefing'])
  })

  it('should honour a briefing time on the other side of midnight', async () => {
    const h = harness({ at: '2026-09-19T01:00:00.000+03:00', settings: { briefingTime: '23:00' } })

    await h.scheduler.tick()

    expect(h.delivered.map((n) => n.kind)).toEqual(['briefing'])
  })

  it('should not brief in the morning for a time chosen late last night', async () => {
    const h = harness({ at: '2026-09-19T10:00:00.000+03:00', settings: { briefingTime: '23:00' } })

    await h.scheduler.tick()

    expect(h.delivered).toEqual([])
  })

  it('should not brief ahead of a time later the same day', async () => {
    const h = harness({ at: '2026-09-19T09:00:00.000+03:00', settings: { briefingTime: '23:00' } })

    await h.scheduler.tick()

    expect(h.delivered).toEqual([])
  })

  it('should not say good morning hours after the fact', async () => {
    const h = harness({ at: '2026-09-19T16:00:00.000+03:00' })

    await h.scheduler.tick()

    expect(h.delivered).toEqual([])
  })

  it('should not brief twice in one day', async () => {
    const h = harness({
      at: '2026-09-19T09:00:00.000+03:00',
      marks: { briefing: '2026-09-19' }
    })

    await h.scheduler.tick()

    expect(h.delivered).toEqual([])
  })

  it('should record what it delivered so a relaunch stays quiet', async () => {
    const h = harness({ at: '2026-09-19T08:00:00.000+03:00' })

    await h.scheduler.tick()

    expect(h.written.at(-1)).toEqual({ briefing: '2026-09-19' })
  })

  it('should say nothing at all when notices are turned off', async () => {
    const h = harness({
      at: '2026-09-19T08:00:00.000+03:00',
      settings: { noticesEnabled: false },
      notices: [DISK]
    })

    await h.scheduler.tick()

    expect(h.delivered).toEqual([])
  })

  it('should honour a single kind being switched off', async () => {
    const h = harness({
      at: '2026-09-19T08:00:00.000+03:00',
      settings: {
        noticeKinds: { briefing: false, disk: true, meeting: true, agenda: true, clutter: true }
      },
      notices: [DISK]
    })

    await h.scheduler.tick()

    expect(h.delivered.map((n) => n.kind)).toEqual(['disk'])
  })

  it('should hold everything back while the assistant is working', async () => {
    const h = harness({
      at: '2026-09-19T08:00:00.000+03:00',
      busy: true,
      notices: [DISK]
    })

    await h.scheduler.tick()

    expect(h.delivered).toEqual([])
  })

  it('should still mark a briefing that gathered nothing, so it stops retrying', async () => {
    const h = harness({ at: '2026-09-19T08:00:00.000+03:00', briefing: null })

    await h.scheduler.tick()

    expect(h.delivered).toEqual([])
    expect(h.written.at(-1)).toEqual({ briefing: '2026-09-19' })
  })

  it('should ask the model to write the briefing when the owner chose prose', async () => {
    const h = harness({
      at: '2026-09-19T08:00:00.000+03:00',
      settings: { briefingStyle: 'written' }
    })

    await h.scheduler.tick()

    expect(h.spoken).toHaveLength(1)
    expect(h.delivered.map((n) => n.kind)).toEqual(['briefing'])
  })

  it('should still show the facts when the model cannot be asked for prose', async () => {
    const h = harness({
      at: '2026-09-19T08:00:00.000+03:00',
      settings: { briefingStyle: 'written' },
      speakFails: true
    })

    await expect(h.scheduler.tick()).resolves.toBeUndefined()
    expect(h.delivered.map((n) => n.kind)).toEqual(['briefing'])
  })

  it('should survive a notice that could not be shown', async () => {
    const h = harness({
      at: '2026-09-19T16:00:00.000+03:00',
      notices: [DISK],
      deliverFails: true
    })

    await expect(h.scheduler.tick()).resolves.toBeUndefined()
  })

  it('should try again next tick when a notice could not be shown', async () => {
    const h = harness({
      at: '2026-09-19T16:00:00.000+03:00',
      notices: [DISK],
      deliverFails: true
    })

    await h.scheduler.tick()

    expect(h.marks).toEqual({})
  })

  it('should survive a briefing that could not be put together at all', async () => {
    const h = harness({ at: '2026-09-19T08:00:00.000+03:00', composeThrows: true })

    await expect(h.scheduler.tick()).resolves.toBeUndefined()
  })

  it('should survive a watcher that could not look', async () => {
    const h = harness({ at: '2026-09-19T16:00:00.000+03:00', checkThrows: true })

    await expect(h.scheduler.tick()).resolves.toBeUndefined()
  })

  it('should not push a notice into a run it just started', async () => {
    let working = false
    const h = harness({
      at: '2026-09-19T08:00:00.000+03:00',
      settings: { briefingStyle: 'written' },
      notices: [DISK],
      onSpeak: () => {
        working = true
      },
      busyAfterSpeak: () => working
    })

    await h.scheduler.tick()

    expect(h.delivered.map((n) => n.kind)).toEqual(['briefing'])
  })

  it('should tell the settings preview when there was nothing to report', async () => {
    const h = harness({ at: '2026-09-19T08:00:00.000+03:00', briefing: null })

    await expect(h.scheduler.briefNow()).resolves.toBe(false)
  })

  it('should tell the settings preview when the briefing went out', async () => {
    const h = harness({ at: '2026-09-19T08:00:00.000+03:00' })

    await expect(h.scheduler.briefNow()).resolves.toBe(true)
    expect(h.delivered.map((n) => n.kind)).toEqual(['briefing'])
  })

  it('should deliver a condition notice without waiting for the morning', async () => {
    const h = harness({ at: '2026-09-19T16:00:00.000+03:00', notices: [DISK] })

    await h.scheduler.tick()

    expect(h.delivered.map((n) => n.kind)).toEqual(['disk'])
  })

  it('should not repeat a condition notice with the same fingerprint', async () => {
    const h = harness({
      at: '2026-09-19T16:00:00.000+03:00',
      notices: [DISK],
      marks: { disk: '2026-09-19' }
    })

    await h.scheduler.tick()

    expect(h.delivered).toEqual([])
  })

  it('should stay quiet for the whole day when notices are paused', async () => {
    const h = harness({
      at: '2026-09-19T08:00:00.000+03:00',
      pausedUntil: '2026-09-19T21:00:00.000Z',
      notices: [DISK]
    })

    await h.scheduler.tick()

    expect(h.delivered).toEqual([])
    expect(h.pauseWrites).toEqual([])
  })

  it('should clear an expired pause and deliver again', async () => {
    const h = harness({
      at: '2026-09-20T16:00:00.000+03:00',
      pausedUntil: '2026-09-19T21:00:00.000Z',
      notices: [DISK]
    })

    await h.scheduler.tick()

    expect(h.pauseWrites).toEqual([null])
    expect(h.delivered.map((n) => n.kind)).toEqual(['disk'])
  })

  it('should clear a focus pause once the meeting has ended', async () => {
    const h = harness({
      at: '2026-09-20T12:01:00.000+03:00',
      pausedUntil: '2026-09-20T09:00:00.000Z',
      notices: [DISK]
    })

    await h.scheduler.tick()

    expect(h.pauseWrites).toEqual([null])
    expect(h.delivered.map((n) => n.kind)).toEqual(['disk'])
  })

  it('should stay quiet during a focus pause', async () => {
    const h = harness({
      at: '2026-09-20T11:30:00.000+03:00',
      pausedUntil: '2026-09-20T09:00:00.000Z',
      notices: [DISK]
    })

    await h.scheduler.tick()

    expect(h.pauseWrites).toEqual([])
    expect(h.delivered).toEqual([])
  })

  it('should clear an expired pause even when the master switch is off', async () => {
    const h = harness({
      at: '2026-09-20T16:00:00.000+03:00',
      pausedUntil: '2026-09-19T21:00:00.000Z',
      settings: { noticesEnabled: false }
    })

    await h.scheduler.tick()

    expect(h.pauseWrites).toEqual([null])
    expect(h.delivered).toEqual([])
  })

  it('should still preview the briefing while notices are paused', async () => {
    const h = harness({
      at: '2026-09-19T08:00:00.000+03:00',
      pausedUntil: '2026-09-19T21:00:00.000Z'
    })

    await expect(h.scheduler.briefNow()).resolves.toBe(true)
    expect(h.delivered.map((n) => n.kind)).toEqual(['briefing'])
  })

  it('should deliver only the highest-priority condition notice per tick', async () => {
    const h = harness({
      at: '2026-09-19T16:00:00.000+03:00',
      notices: [DISK, MEETING]
    })

    await h.scheduler.tick()

    expect(h.delivered.map((n) => n.kind)).toEqual(['meeting'])
  })

  it('should still deliver the briefing alone before picking one condition', async () => {
    const h = harness({
      at: '2026-09-19T08:00:00.000+03:00',
      notices: [DISK, MEETING]
    })

    await h.scheduler.tick()

    expect(h.delivered.map((n) => n.kind)).toEqual(['briefing', 'meeting'])
  })
})
