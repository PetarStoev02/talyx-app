import type { CalendarEvent, Proposal, ResultCard } from '../../instruction/model/Capability'
import { NEARLY_FULL_RATIO } from '../../instruction/capabilities/system'
import { dayStamp, DAILY_KINDS, type Notice, type NoticeKind } from '../model/Notice'
import type { ReadCapability } from './readCapability'

export interface NoticeWatcherDeps {
  read: ReadCapability
  now(): Date
  /** Loose files in a folder. Cheaper than the whole clutter breakdown, which the owner can still ask for. */
  countLooseFiles(folderPath: string): Promise<number>
  downloadsPath: string
  warn(message: string): void
}

export interface NoticeCheck {
  kinds: NoticeKind[]
  /** The last fingerprint delivered per kind, so a daily check can skip the work entirely. */
  marks: Record<string, string>
}

/** Close enough that saying it is still useful, far enough to stand up and walk. */
const MEETING_SOON_MINUTES = 10
/** Far enough ahead that an agenda can still be written, so the two never fire together. */
const AGENDA_LEAD_MINUTES = 60
/** Below this, a Downloads folder is a filing problem rather than a folder. */
const CLUTTER_FILES = 100
const MINUTE_MS = 60 * 1000
/**
 * How long one calendar read stands in for the next. Reading means spawning an
 * osascript against Calendar.app, and doing that every single minute all day is
 * a lot of battery for a diary that rarely changes. Comfortably shorter than the
 * ten-minute meeting window, so nothing is ever noticed late enough to matter.
 */
const CALENDAR_CACHE_MS = 5 * MINUTE_MS

/**
 * The conditions Talyx is allowed to raise on its own. Every one reads through
 * an existing ability, so a notice can never know something the owner could not
 * have asked for.
 */
export class NoticeWatcher {
  private cachedDay: { at: number; events: CalendarEvent[] } | null = null

  constructor(private readonly deps: NoticeWatcherDeps) {}

  async check({ kinds, marks }: NoticeCheck): Promise<Notice[]> {
    const wanted = kinds.filter((kind) => !this.alreadyDoneToday(kind, marks))
    const [disk, calendar, clutter] = await Promise.all([
      wanted.includes('disk') ? this.disk() : null,
      wanted.some((k) => k === 'meeting' || k === 'agenda') ? this.calendar(wanted) : [],
      wanted.includes('clutter') ? this.clutter() : null
    ])
    return [disk, ...calendar, clutter].filter((n): n is Notice => n !== null)
  }

  /** A once-a-day notice already delivered today cannot change its mind before midnight. */
  private alreadyDoneToday(kind: NoticeKind, marks: Record<string, string>): boolean {
    return DAILY_KINDS.includes(kind) && marks[kind] === dayStamp(this.deps.now())
  }

  private async disk(): Promise<Notice | null> {
    const card = await this.cardFrom('disk_space', {}, 'disk')
    if (card === null || card.freeBytes / card.totalBytes >= NEARLY_FULL_RATIO) return null
    const percent = Math.round((card.freeBytes / card.totalBytes) * 100)
    return {
      kind: 'disk',
      fingerprint: dayStamp(this.deps.now()),
      title: 'Your disk is nearly full',
      body: `Only ${percent}% of the disk is free.`,
      detail: `Your disk is down to ${percent}% free. Ask me what's cluttering your downloads and I'll show you what to clear.`,
      cards: [card]
    }
  }

  private async calendar(kinds: NoticeKind[]): Promise<(Notice | null)[]> {
    const now = this.deps.now().getTime()
    const events = await this.dayAhead(now)
    if (events === null) return []
    const upcoming = events
      .filter((e) => !e.allDay && Date.parse(e.start) > now)
      .sort((a, b) => a.start.localeCompare(b.start))

    return [
      kinds.includes('meeting') ? this.meeting(upcoming, now) : null,
      kinds.includes('agenda') ? this.agenda(upcoming, now) : null
    ]
  }

  /** Today's events, re-read at most every few minutes. */
  private async dayAhead(now: number): Promise<CalendarEvent[] | null> {
    if (this.cachedDay !== null && now - this.cachedDay.at < CALENDAR_CACHE_MS) {
      return this.cachedDay.events
    }
    const card = await this.cardFrom('today', { day: 'today' }, 'agenda')
    if (card === null) return null
    this.cachedDay = { at: now, events: card.events }
    return card.events
  }

  private meeting(upcoming: CalendarEvent[], now: number): Notice | null {
    const next = upcoming[0]
    if (!next || Date.parse(next.start) - now > MEETING_SOON_MINUTES * MINUTE_MS) return null
    const minutes = Math.max(1, Math.round((Date.parse(next.start) - now) / MINUTE_MS))
    return {
      kind: 'meeting',
      fingerprint: next.start,
      title: 'Starting soon',
      body: `${next.title} in ${minutes} min${next.location ? ` · ${next.location}` : ''}`,
      detail: `**${next.title}** starts in ${minutes} minutes.`,
      cards: [{ kind: 'agenda', day: 'today', events: [next] }]
    }
  }

  private agenda(upcoming: CalendarEvent[], now: number): Notice | null {
    // Bounded at both ends so the two calendar notices never land together:
    // inside the meeting window the reminder to start is the only useful thing
    // to say, and there is no longer time to write an agenda anyway.
    const bare = upcoming.find((e) => {
      const awayMinutes = (Date.parse(e.start) - now) / MINUTE_MS
      return (
        !e.hasNotes &&
        e.location === null &&
        awayMinutes > MEETING_SOON_MINUTES &&
        awayMinutes <= AGENDA_LEAD_MINUTES
      )
    })
    if (!bare) return null
    return {
      kind: 'agenda',
      fingerprint: bare.start,
      title: 'No agenda yet',
      body: `${bare.title} has no agenda and no location.`,
      detail: `**${bare.title}** has no agenda and no location. There is still time to add one.`,
      cards: [{ kind: 'agenda', day: 'today', events: [bare] }]
    }
  }

  private async clutter(): Promise<Notice | null> {
    // A Downloads folder macOS will not let us read must not cost the owner the
    // disk and calendar notices as well.
    const files = await this.deps.countLooseFiles(this.deps.downloadsPath).catch((err: Error) => {
      this.deps.warn(`[notices] could not count ${this.deps.downloadsPath}: ${err.message}`)
      return 0
    })
    if (files <= CLUTTER_FILES) return null
    return {
      kind: 'clutter',
      fingerprint: dayStamp(this.deps.now()),
      title: 'Downloads is piling up',
      body: `${files} loose files in Downloads.`,
      detail: `Downloads is holding ${files} loose files. Ask me to sort it whenever you like.`,
      cards: []
    }
  }

  /** One ability, one card kind: anything else means the catalogue changed under us. */
  private async cardFrom<K extends ResultCard['kind']>(
    capability: string,
    params: unknown,
    kind: K
  ): Promise<Extract<ResultCard, { kind: K }> | null> {
    const proposal: Proposal | null = await this.deps.read(capability, params)
    if (proposal === null || proposal.kind !== 'answer') return null
    const card = proposal.card
    return card !== undefined && card.kind === kind
      ? (card as Extract<ResultCard, { kind: K }>)
      : null
  }
}
