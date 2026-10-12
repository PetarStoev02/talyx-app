import { z } from 'zod/v4'
import { basename, join } from 'path'
import type { CalendarEvent, Capability, PathEntry, Proposal } from '../model/Capability'
import type { RecentFile } from './desktop'
import type { Effect } from '../model/Effect'
import { resolveFolder } from '../model/resolveFolder'

export interface ClutterFile {
  path: string
  name: string
  size: number
  /** ISO 8601. */
  modifiedAt: string
}

/** What the everyday abilities reach: the user's calendar, reminders, notes, documents, folders. */
export interface EverydayCapabilityDeps {
  now(): Date
  calendarEvents(from: Date, to: Date): Promise<CalendarEvent[]>
  createReminder(input: { title: string; due: string | null }): Promise<{ id: string }>
  createNote(input: { title: string; body: string }): Promise<{ id: string }>
  createEvent(input: NewEvent): Promise<{ id: string }>
  deleteEvent(eventId: string): Promise<void>
  /** Write a capture dump as a markdown file under the owner's Capture inbox. */
  saveCaptureFile(input: { title: string; body: string }): Promise<{ path: string }>
  /** Files the user opened in the last `sinceHours`, newest first. */
  recentFiles(sinceHours: number, limit: number): Promise<RecentFile[]>
  extractText(path: string): Promise<{ text: string; truncated: boolean }>
  /** Loose files of one folder, subfolders untouched. */
  scanFiles(folderPath: string): Promise<ClutterFile[]>
}

export interface NewEvent {
  title: string
  /** ISO 8601 with offset. */
  start: string
  end: string
  location: string | null
  /** Which calendar to file it in; null means the default one. */
  calendar: string | null
}

export type ReminderPayload = { title: string; due: string | null }
export type EventInverse = { eventId: string }
export type NotePayload = { title: string; body: string }

const READ_ONLY: Effect = { world: 'reads', reversible: false, discloses: 'nothing' }
const READS_CONTENT: Effect = { world: 'reads', reversible: false, discloses: 'content' }
/** undo_last only knows file payloads today; a reminder or note cannot be taken back yet. */
const ONE_WAY_CREATE: Effect = { world: 'creates', reversible: false, discloses: 'nothing' }

/** Deleting the event we just made puts the calendar back exactly as it was. */
const REVERSIBLE_CREATE: Effect = { world: 'creates', reversible: true, discloses: 'nothing' }

const MAX_NOTE_LABEL_CHARS = 80
const DEFAULT_EVENT_MINUTES = 60
const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
/** When a morning starts and when it stops being one. */
const MORNING_FROM_HOUR = 5
export const MORNING_TO_HOUR = 12
const RECALL_FILE_LIMIT = 20
const RECALL_FILE_SEARCH = 200
const CLUTTER_PER_LIST = 15
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const folderParam = z
  .string()
  .min(1)
  .default('downloads')
  .transform((value, ctx) => {
    try {
      return resolveFolder(value)
    } catch (err) {
      ctx.addIssue({ code: 'custom', message: (err as Error).message })
      return z.NEVER
    }
  })
  .describe('Folder to look at — a full path, or a name like Downloads or Desktop')

export function everydayCapabilities(deps: EverydayCapabilityDeps): Capability[] {
  const today: Capability<{ day: AgendaSpan }> = {
    name: 'today',
    description: "What is on the user's calendar today, tomorrow or over the next seven days",
    examples: [
      "what's on today",
      'do I have anything tomorrow',
      'when is my next meeting',
      "what's my week like"
    ],
    params: z.object({
      day: z.enum(['today', 'tomorrow', 'week']).default('today').describe('Which span to look at')
    }),
    effect: READ_ONLY,
    async plan({ day }): Promise<Proposal> {
      const [from, to] = agendaRange(deps.now(), day)
      const events = await deps.calendarEvents(from, to)
      const label = day === 'week' ? 'this week' : day
      const summary =
        events.length === 0
          ? `Nothing on your calendar ${label}`
          : `${events.length} event${events.length === 1 ? '' : 's'} ${label}`
      return {
        kind: 'answer',
        summary,
        evidence: events.map((e) => ({
          source: e.calendar,
          text:
            day === 'week' ? `${dayLabel(new Date(e.start))} ${describeEvent(e)}` : describeEvent(e)
        })),
        card: { kind: 'agenda', day, events }
      }
    }
  }

  const remindMe: Capability<ReminderPayload> = {
    name: 'remind_me',
    description:
      'Add a reminder to the Reminders app, optionally due at a date and time. Also how a timer is set — work out when it goes off and use that as the due time',
    examples: [
      'remind me to call mom at 6',
      'remind me tomorrow morning to send the invoice',
      'set a timer for 10 minutes',
      'timer for an hour, the roast is in'
    ],
    params: z.object({
      title: z.string().min(1).describe('What to remind the user about'),
      due: z.iso
        .datetime({ offset: true })
        .nullable()
        .default(null)
        .describe('When it is due, as ISO 8601 with offset; null when there is no time')
    }),
    effect: ONE_WAY_CREATE,
    async plan({ title, due }): Promise<Proposal> {
      return {
        kind: 'plan',
        summary: `Remind you: ${title}`,
        operations: [
          {
            label: `${title} · ${due ? shortDateTime(new Date(due)) : 'no time'}`,
            reason: 'reminder',
            payload: { title, due },
            inverse: null
          }
        ]
      }
    },
    async execute(op) {
      await deps.createReminder(op.payload as ReminderPayload)
      return 'Reminder added'
    }
  }

  const takeNote: Capability<NotePayload> = {
    name: 'take_note',
    description: 'Save a note in the Notes app',
    examples: ['note: buy filters for the coffee machine', 'write down that the wifi code is 4411'],
    params: z.object({
      title: z.string().min(1).describe('Short title of the note'),
      body: z.string().default('').describe('The note itself')
    }),
    effect: ONE_WAY_CREATE,
    async plan({ title, body }): Promise<Proposal> {
      return {
        kind: 'plan',
        summary: `Save a note: ${title}`,
        operations: [
          { label: noteLabel(title, body), reason: 'note', payload: { title, body }, inverse: null }
        ]
      }
    },
    async execute(op) {
      await deps.createNote(op.payload as NotePayload)
      return 'Note saved'
    }
  }

  const saveToInbox: Capability<NotePayload> = {
    name: 'save_to_inbox',
    description: 'Save a capture dump as a markdown file in Documents/Talyx Capture on this Mac',
    examples: ['file this dump', 'save to inbox', 'keep this as a file'],
    params: z.object({
      title: z.string().min(1).describe('Short title used in the file name'),
      body: z.string().default('').describe('Markdown body of the capture')
    }),
    effect: ONE_WAY_CREATE,
    async plan({ title, body }): Promise<Proposal> {
      return {
        kind: 'plan',
        summary: `Save to Capture inbox: ${title}`,
        operations: [
          {
            label: noteLabel(title, body),
            reason: 'capture file',
            payload: { title, body },
            inverse: null
          }
        ]
      }
    },
    async execute(op) {
      const { path } = await deps.saveCaptureFile(op.payload as NotePayload)
      return `Saved to ${path}`
    }
  }

  const readDocument: Capability<{ path: string }> = {
    name: 'read_document',
    description:
      'Read the text of a document (PDF, Word, Excel, text) so it can be summarised or answered about',
    examples: ['summarise ~/Documents/lease.pdf', 'what does this contract say about notice'],
    params: z.object({
      path: z.string().min(1).describe('Full path of the document, ~ allowed')
    }),
    effect: READS_CONTENT,
    async plan({ path }, ctx): Promise<Proposal> {
      const resolved = path.startsWith('~') ? join(ctx.home, path.slice(1)) : path
      const name = basename(resolved)
      const { text, truncated } = await deps.extractText(resolved)
      if (text.trim().length === 0) {
        return { kind: 'answer', summary: `No readable text in ${name}`, evidence: [] }
      }
      return {
        kind: 'answer',
        summary: `${name} — ${text.length} characters${truncated ? ', cut off at the limit' : ''}`,
        evidence: [{ source: resolved, text }]
      }
    }
  }

  const whatsCluttering: Capability<{ folder: string }> = {
    name: 'whats_cluttering',
    description:
      'Show which files take the most space or have sat untouched the longest in a folder',
    examples: ["what's cluttering my downloads", 'what is taking space on my desktop'],
    params: z.object({ folder: folderParam }),
    effect: READ_ONLY,
    async plan({ folder }): Promise<Proposal> {
      const files = await deps.scanFiles(folder)
      const label = basename(folder).toLowerCase()
      if (files.length === 0) return { kind: 'answer', summary: `${label} is empty`, evidence: [] }
      const now = deps.now()
      const largest = [...files].sort((a, b) => b.size - a.size).slice(0, CLUTTER_PER_LIST)
      const oldest = [...files]
        .filter((f) => !largest.includes(f))
        .sort((a, b) => Date.parse(a.modifiedAt) - Date.parse(b.modifiedAt))
        .slice(0, CLUTTER_PER_LIST)
      const picked = [...largest, ...oldest]
      const total = files.reduce((sum, f) => sum + f.size, 0)
      const largestTotal = largest.reduce((sum, f) => sum + f.size, 0)
      const line = (f: ClutterFile): string => `${humanSize(f.size)} · ${ageOf(f.modifiedAt, now)}`
      return {
        kind: 'answer',
        summary: `${label}: ${files.length} files, ${humanSize(total)} — the largest ${largest.length} hold ${humanSize(largestTotal)}`,
        evidence: picked.map((f) => ({ source: f.path, text: `${f.name} · ${line(f)}` })),
        card: {
          kind: 'paths',
          entries: picked.map((f) => ({
            path: f.path,
            label: f.name,
            snippet: line(f),
            isDirectory: false
          }))
        }
      }
    }
  }

  const createEvent: Capability<{
    title: string
    start: string
    durationMinutes: number
    location: string | null
    calendar: string | null
  }> = {
    name: 'create_event',
    description: 'Put an event in the calendar at a given time',
    examples: [
      'put dentist in my calendar on Thursday at 4',
      'book an hour tomorrow morning for the report',
      'add lunch with Maria at 1 on Friday'
    ],
    params: z.object({
      title: z.string().min(1).describe('What the event is called'),
      start: z.iso.datetime({ offset: true }).describe('When it starts, as ISO 8601 with offset'),
      durationMinutes: z
        .number()
        .int()
        .min(1)
        .max(24 * 60)
        .default(DEFAULT_EVENT_MINUTES)
        .describe('How long it lasts, in minutes'),
      location: z.string().min(1).nullable().default(null).describe('Where it is'),
      calendar: z
        .string()
        .min(1)
        .nullable()
        .default(null)
        .describe('Which calendar to use; leave empty for the default one')
    }),
    effect: REVERSIBLE_CREATE,
    async plan({ title, start, durationMinutes, location, calendar }): Promise<Proposal> {
      const startsAt = new Date(start)
      const endsAt = new Date(startsAt.getTime() + durationMinutes * MINUTE_MS)
      const event: NewEvent = {
        title,
        start,
        end: endsAt.toISOString(),
        location,
        calendar
      }
      return {
        kind: 'plan',
        summary: `Add to your calendar: ${title}`,
        operations: [
          {
            label: `${title} · ${shortDateTime(startsAt)}–${clock(endsAt)}${location ? ` · ${location}` : ''}`,
            reason: 'calendar event',
            payload: event,
            // The id only exists once the event does; execute fills it in, and
            // CapabilityDispatcher logs the inverse after execute returns.
            inverse: null
          }
        ]
      }
    },
    async execute(op) {
      const { id } = await deps.createEvent(op.payload as NewEvent)
      op.inverse = { eventId: id } satisfies EventInverse
      return 'Event added'
    },
    async revert(op) {
      await deps.deleteEvent((op.inverse as EventInverse).eventId)
    }
  }

  const whatDidIDo: Capability<{ window: RecallWindow }> = {
    name: 'what_did_i_do',
    description: 'Recap the meetings attended and the files worked on over a past stretch of time',
    examples: [
      'what did I do this morning',
      'what was I up to yesterday',
      'what have I done today'
    ],
    params: z.object({
      window: z
        .enum(['morning', 'today', 'yesterday'])
        .default('morning')
        .describe('Which stretch of time to recap')
    }),
    effect: READ_ONLY,
    async plan({ window }): Promise<Proposal> {
      const now = deps.now()
      const [from, to] = recallRange(now, window)
      const [events, recent] = await Promise.all([
        deps.calendarEvents(from, to),
        // recentFiles counts back from now and returns the newest first, so a
        // window that ended hours ago is crowded out unless we over-ask.
        deps.recentFiles(hoursSince(from, now), RECALL_FILE_SEARCH)
      ])
      const files = recent
        .filter((f) => within(Date.parse(f.lastUsedAt), from, to))
        .slice(0, RECALL_FILE_LIMIT)
      const entries: PathEntry[] = files.map((f) => ({
        path: f.path,
        label: f.name,
        snippet: clock(new Date(f.lastUsedAt)),
        isDirectory: false
      }))
      return {
        kind: 'answer',
        summary: `${RECALL_LABELS[window]}: ${count(events.length, 'meeting')}, ${count(files.length, 'file')}`,
        evidence: [
          ...events.map((e) => ({ source: e.calendar, text: describeEvent(e) })),
          ...files.map((f) => ({
            source: f.path,
            text: `${f.name} · ${clock(new Date(f.lastUsedAt))}`
          }))
        ],
        ...(entries.length > 0 ? { card: { kind: 'paths' as const, entries } } : {})
      }
    }
  }

  return [
    today as Capability,
    remindMe as Capability,
    takeNote as Capability,
    saveToInbox as Capability,
    createEvent as Capability,
    whatDidIDo as Capability,
    readDocument as Capability,
    whatsCluttering as Capability
  ]
}

type RecallWindow = 'morning' | 'today' | 'yesterday'

const RECALL_LABELS: Record<RecallWindow, string> = {
  morning: 'This morning',
  today: 'Today',
  yesterday: 'Yesterday'
}

/** Local time, as the user experienced it — never UTC. */
function recallRange(now: Date, window: RecallWindow): [Date, Date] {
  if (window === 'yesterday') return dayRange(now, -1)
  if (window === 'today') return [atHour(now, 0), now]
  const from = atHour(now, MORNING_FROM_HOUR)
  // Asked at 03:00 the morning has not started, and a 05:00-to-03:00 range is
  // backwards; someone awake then means the day so far.
  if (now < from) return [atHour(now, 0), now]
  const midday = atHour(now, MORNING_TO_HOUR)
  // Asked at 09:00 the morning is still running; asked at 18:00 it ended at midday.
  return [from, now < midday ? now : midday]
}

function atHour(now: Date, hour: number): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour)
}

function within(at: number, from: Date, to: Date): boolean {
  return at >= from.getTime() && at <= to.getTime()
}

function hoursSince(from: Date, now: Date): number {
  return Math.max(1, Math.ceil((now.getTime() - from.getTime()) / HOUR_MS))
}

function count(n: number, noun: string): string {
  if (n === 0) return `no ${noun}s`
  return `${n} ${noun}${n === 1 ? '' : 's'}`
}

/** Local midnight to the next, `offsetDays` days from now. */
export function dayRange(now: Date, offsetDays: number): [Date, Date] {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays)
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays + 1)
  return [from, to]
}

type AgendaSpan = 'today' | 'tomorrow' | 'week'

/** "week" is the next seven days from today's midnight, not the calendar week. */
function agendaRange(now: Date, span: AgendaSpan): [Date, Date] {
  if (span === 'week') return [dayRange(now, 0)[0], dayRange(now, 6)[1]]
  return dayRange(now, span === 'tomorrow' ? 1 : 0)
}

function dayLabel(d: Date): string {
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export function describeEvent(e: CalendarEvent): string {
  const when = e.allDay ? 'All day' : `${clock(new Date(e.start))}–${clock(new Date(e.end))}`
  return `${when} ${e.title}${e.location ? ` · ${e.location}` : ''}`
}

export function clock(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function shortDateTime(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${clock(d)}`
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

function noteLabel(title: string, body: string): string {
  if (body.length === 0) return title
  const shown =
    body.length > MAX_NOTE_LABEL_CHARS ? `${body.slice(0, MAX_NOTE_LABEL_CHARS)}…` : body
  return `${title} — ${shown}`
}

const KILOBYTE = 1024

function humanSize(bytes: number): string {
  if (bytes < KILOBYTE) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / KILOBYTE
  let unit = 0
  while (value >= KILOBYTE && unit < units.length - 1) {
    value /= KILOBYTE
    unit++
  }
  return `${value.toFixed(1)} ${units[unit]}`
}

const DAY_MS = 24 * 60 * 60 * 1000

function ageOf(modifiedAt: string, now: Date): string {
  const days = Math.floor((now.getTime() - Date.parse(modifiedAt)) / DAY_MS)
  if (days < 1) return 'today'
  if (days >= 365) return plural(Math.floor(days / 365), 'year')
  if (days >= 30) return plural(Math.floor(days / 30), 'month')
  return plural(days, 'day')
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? '' : 's'} old`
}
