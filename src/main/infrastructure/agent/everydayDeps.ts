import type { TextExtractor } from '../../domain/classification/services/TextExtractor'
import type { RecentFile } from '../../domain/instruction/capabilities/desktop'
import type { CalendarEvent } from '../../domain/instruction/model/Capability'
import type { EverydayCapabilityDeps } from '../../domain/instruction/capabilities/everyday'
import { writeCaptureInboxFile } from '../../domain/capture/captureInbox'
import { scanForSort } from '../../domain/shared/scanForSort'
import { runJxa } from './appleScript'

const MAX_DOCUMENT_CHARS = 12_000

/** Arguments arrive as strings; scripts print one JSON value. */

/**
 * Calendar and Reminders go through EventKit, not app scripting. Calendar.app
 * only exposes a repeating event as its first occurrence plus a rule, so a
 * "this week" query by start date missed every standup and gym session, and
 * scanning every event for rules took ~7 ms each. EventKit expands series
 * itself and answers in milliseconds, and one Calendar grant covers reads and
 * writes. The first call makes macOS ask for access for Talyx.
 */
const EVENTKIT_PRELUDE = `
ObjC.import('EventKit')
const EVENT = 0
const REMINDER = 1
const FULL_ACCESS = 3
const NOT_DETERMINED = 0
const PROMPT_WAIT_MS = 12000
const THIS_EVENT = 0
const PANE = { [EVENT]: 'Calendars', [REMINDER]: 'Reminders' }
// The bridge hands the enum back as a string.
const status = (entity) => Number($.EKEventStore.authorizationStatusForEntityType(entity))
function openStore(entity) {
  const store = $.EKEventStore.alloc.init
  if (status(entity) === NOT_DETERMINED) {
    // The completion block never reaches JXA; the status itself is the answer.
    try {
      if (entity === EVENT) store.requestFullAccessToEventsWithCompletion(() => {})
      else store.requestFullAccessToRemindersWithCompletion(() => {})
    } catch (e) {
      // macOS 13 has only the pre-Sonoma selector.
      store.requestAccessToEntityTypeCompletion(entity, () => {})
    }
    const deadline = Date.now() + PROMPT_WAIT_MS
    while (status(entity) === NOT_DETERMINED && Date.now() < deadline) {
      $.NSRunLoop.currentRunLoop.runUntilDate($.NSDate.dateWithTimeIntervalSinceNow(0.1))
    }
    if (status(entity) === NOT_DETERMINED) {
      throw new Error('macOS is asking whether Talyx may use your ' + PANE[entity].toLowerCase() + '. Answer that prompt, then ask again')
    }
  }
  if (status(entity) !== FULL_ACCESS) {
    throw new Error('Talyx cannot use your ' + PANE[entity].toLowerCase() + '. Turn it on in System Settings > Privacy & Security > ' + PANE[entity])
  }
  return store
}
const nsDate = (iso) => $.NSDate.dateWithTimeIntervalSince1970(new Date(iso).getTime() / 1000)
const text = (value) => { const s = ObjC.unwrap(value); return typeof s === 'string' && s.length > 0 ? s : null }
function commit(saved, error) {
  if (!saved) throw new Error(text(error[0].localizedDescription) || 'The change could not be saved')
}
function writableCalendar(store, entity, name) {
  const all = ObjC.unwrap(store.calendarsForEntityType(entity))
  if (name) {
    const hit = all.find((c) => text(c.title) === name)
    if (!hit) throw new Error('There is no calendar called ' + name)
    if (!hit.allowsContentModifications) throw new Error('The calendar ' + name + ' is read-only')
    return hit
  }
  const preferred = entity === EVENT ? store.defaultCalendarForNewEvents : store.defaultCalendarForNewReminders
  if (!preferred.isNil()) return preferred
  const fallback = all.find((c) => c.allowsContentModifications)
  if (!fallback) throw new Error('No calendar on this Mac can be written to')
  return fallback
}`

const CALENDAR_EVENTS = `${EVENTKIT_PRELUDE}
function run(argv) {
  const store = openStore(EVENT)
  const predicate = store.predicateForEventsWithStartDateEndDateCalendars(nsDate(argv[0]), nsDate(argv[1]), $())
  const out = ObjC.unwrap(store.eventsMatchingPredicate(predicate)).map((ev) => ({
    title: text(ev.title) || '',
    start: ObjC.unwrap(ev.startDate).toISOString(),
    end: ObjC.unwrap(ev.endDate).toISOString(),
    location: text(ev.location),
    calendar: text(ev.calendar.title) || '',
    allDay: !!ev.isAllDay,
    hasNotes: !!ev.hasNotes
  }))
  out.sort((a, b) => a.start.localeCompare(b.start))
  return JSON.stringify(out)
}`

const CREATE_EVENT = `${EVENTKIT_PRELUDE}
function run(argv) {
  const store = openStore(EVENT)
  const event = $.EKEvent.eventWithEventStore(store)
  event.title = argv[0]
  event.startDate = nsDate(argv[1])
  event.endDate = nsDate(argv[2])
  if (argv[3]) event.location = argv[3]
  event.calendar = writableCalendar(store, EVENT, argv[4])
  const error = Ref()
  commit(store.saveEventSpanCommitError(event, THIS_EVENT, true, error), error)
  return JSON.stringify({ id: text(event.eventIdentifier) })
}`

const DELETE_EVENT = `${EVENTKIT_PRELUDE}
function run(argv) {
  const store = openStore(EVENT)
  let event = store.eventWithIdentifier(argv[0])
  // Events added before EventKit were logged under their iCal UID.
  if (event.isNil()) event = ObjC.unwrap(store.calendarItemsWithExternalIdentifier(argv[0]))[0] || event
  if (event.isNil()) throw new Error('That event is no longer in the calendar')
  const error = Ref()
  commit(store.removeEventSpanCommitError(event, THIS_EVENT, true, error), error)
  return JSON.stringify({ ok: true })
}`

/** Year|Month|Day|Hour|Minute — the components a due time is made of. */
const CREATE_REMINDER = `${EVENTKIT_PRELUDE}
const DUE_UNITS = (1 << 2) | (1 << 3) | (1 << 4) | (1 << 5) | (1 << 6)
function run(argv) {
  const store = openStore(REMINDER)
  const reminder = $.EKReminder.reminderWithEventStore(store)
  reminder.title = argv[0]
  reminder.calendar = writableCalendar(store, REMINDER, '')
  if (argv[1]) {
    const due = nsDate(argv[1])
    reminder.dueDateComponents = $.NSCalendar.currentCalendar.componentsFromDate(DUE_UNITS, due)
    // A due time alone is silent; the alarm is what makes a timer ring.
    reminder.addAlarm($.EKAlarm.alarmWithAbsoluteDate(due))
  }
  const error = Ref()
  commit(store.saveReminderCommitError(reminder, true, error), error)
  return JSON.stringify({ id: text(reminder.calendarItemIdentifier) })
}`

const CREATE_NOTE = `
function run(argv) {
  const app = Application('Notes')
  const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const body = '<div><h1>' + escape(argv[0]) + '</h1></div>' + argv[1].split('\\n').map((l) => '<div>' + (escape(l) || '<br>') + '</div>').join('')
  const note = app.Note({ name: argv[0], body })
  app.defaultAccount().defaultFolder().notes.push(note)
  return JSON.stringify({ id: note.id() })
}`

export function everydayDeps(
  textExtractor: TextExtractor,
  recentFiles: (sinceHours: number, limit: number) => Promise<RecentFile[]>
): EverydayCapabilityDeps {
  return {
    now: () => new Date(),
    calendarEvents: (from, to) =>
      runJxa<CalendarEvent[]>(CALENDAR_EVENTS, [from.toISOString(), to.toISOString()]),
    createReminder: ({ title, due }) => runJxa<{ id: string }>(CREATE_REMINDER, [title, due ?? '']),
    createNote: ({ title, body }) => runJxa<{ id: string }>(CREATE_NOTE, [title, body]),
    createEvent: ({ title, start, end, location, calendar }) =>
      runJxa<{ id: string }>(CREATE_EVENT, [title, start, end, location ?? '', calendar ?? '']),
    async deleteEvent(eventId) {
      await runJxa(DELETE_EVENT, [eventId])
    },
    async saveCaptureFile({ title, body }) {
      return writeCaptureInboxFile({ title, body })
    },
    recentFiles,
    async extractText(path) {
      const result = await textExtractor.extract(path)
      const cut = result.text.length > MAX_DOCUMENT_CHARS
      return {
        text: cut ? result.text.slice(0, MAX_DOCUMENT_CHARS) : result.text,
        truncated: cut || result.truncated
      }
    },
    async scanFiles(folderPath) {
      const scan = await scanForSort(folderPath)
      return scan.files.map((f) => ({
        path: f.path,
        name: f.name,
        size: f.size,
        modifiedAt: f.modifiedAt.toISOString()
      }))
    }
  }
}
