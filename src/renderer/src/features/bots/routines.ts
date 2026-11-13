/** A scheduled job in the bot's own cron store; the engine runs it with the app closed. */
export interface Routine {
  id: string
  name: string
  schedule: string
  active: boolean
  postsToChat: boolean
}

export type ScheduleKind = 'daily' | 'weekdays' | 'weekly' | 'hours' | 'custom'

export interface ScheduleDraft {
  kind: ScheduleKind
  /** HH:MM */
  time: string
  /** 0 = Sunday, as cron counts. */
  weekday: number
  hours: number
  custom: string
}

export interface RoutineDraft {
  name: string
  instruction: string
  schedule: ScheduleDraft
  postsToChat: boolean
}

/** One routine as the dialog shows it: the form's fields, then what the engine says of its runs. */
export interface RoutineDetails {
  id: string
  draft: RoutineDraft
  active: boolean
  /** ISO times, as the engine writes them. */
  nextRunAt: string | null
  lastRunAt: string | null
  lastStatus: string | null
  lastError: string | null
}

export interface RoutineRun {
  id: string
  /** The run's session, where its output is; null for a script-only run, which has none. */
  sessionId: string | null
  /** Seconds since the epoch. */
  startedAt: number
  state: RunState
  /** Why a run that did not finish stopped, as the engine says it; empty otherwise. */
  reason: string
  /** A script-only run's output, as the engine keeps it on the row: only its start. */
  preview: string | null
}

/** What one run produced, opened from its row. */
export interface RunOutput {
  /** The bot's last reply in the run; null when it wrote none. */
  output: string | null
  error: string | null
}

export type RunState = 'running' | 'finished' | 'stopped'

/** A routine as the engine keeps it; `schedule` is a line the engine reads back as the same one. */
export interface StoredRoutine extends Omit<RoutineDetails, 'draft'> {
  name: string
  instruction: string
  schedule: string
  postsToChat: boolean
}

/** What changed in a routine; a field left out stays as it is. */
export type RoutineUpdates = Partial<
  Pick<StoredRoutine, 'name' | 'instruction' | 'schedule' | 'postsToChat'>
>

/** A bot's routines in its own cron store; the engine runs them with the app closed. */
export interface RoutinesBackend {
  listRoutines: (profile: string) => Promise<Routine[]>
  addRoutine: (
    profile: string,
    routine: Pick<StoredRoutine, 'name' | 'instruction' | 'schedule' | 'postsToChat'>
  ) => Promise<void>
  removeRoutine: (profile: string, id: string) => Promise<void>
  setRoutineActive: (profile: string, routine: { id: string; active: boolean }) => Promise<void>
  loadRoutine: (profile: string, id: string) => Promise<StoredRoutine>
  updateRoutine: (profile: string, id: string, updates: RoutineUpdates) => Promise<void>
  /** The most recent runs, newest first. */
  listRoutineRuns: (profile: string, id: string) => Promise<RoutineRun[]>
  /** The bot's last reply in a run's session; null when it wrote none. */
  lastRunReply: (profile: string, sessionId: string) => Promise<string | null>
  /** Fires the routine now; resolves once the engine has run it. */
  runRoutine: (profile: string, id: string) => Promise<void>
}

export interface RoutineEdit {
  id: string
  before: RoutineDraft
  after: RoutineDraft
}

export const DEFAULT_SCHEDULE: ScheduleDraft = {
  kind: 'daily',
  time: '09:00',
  weekday: 1,
  hours: 1,
  custom: ''
}

const AT_TIME = /^(\d{1,2}) (\d{1,2}) \* \* (\*|1-5|[0-6])$/
const EVERY_HOURS = /^every (\d+)h$/
// How the engine stores an interval ("every 2h" comes back as "every 120m"), and a cron step.
const EVERY_MINUTES = /^every (\d+)m$/
const CRON_MINUTES = /^\*\/(\d{1,2}) \* \* \* \*$/
const MINUTES_PER_HOUR = 60
export const MAX_HOURS = 24

export function composeSchedule(draft: ScheduleDraft): string {
  const [hour, minute] = draft.time.split(':').map(Number)
  const at = `${minute} ${hour} * *`
  switch (draft.kind) {
    case 'daily':
      return `${at} *`
    case 'weekdays':
      return `${at} 1-5`
    case 'weekly':
      return `${at} ${draft.weekday}`
    case 'hours':
      return `every ${draft.hours}h`
    case 'custom':
      return draft.custom.trim()
  }
}

/** The inverse of composeSchedule for the forms it writes; anything else reads as custom.
 *  `minutes` is set for a custom schedule that runs every few minutes, so it can be worded. */
export function describeSchedule(schedule: string): {
  kind: ScheduleKind
  time: string | null
  weekday: number | null
  hours: number | null
  minutes: number | null
} {
  const none = { time: null, weekday: null, hours: null, minutes: null }
  const minutes = Number((EVERY_MINUTES.exec(schedule) ?? CRON_MINUTES.exec(schedule))?.[1])
  const hours = Number(EVERY_HOURS.exec(schedule)?.[1]) || minutes / MINUTES_PER_HOUR
  if (Number.isInteger(hours) && hours >= 1 && hours <= MAX_HOURS)
    return { ...none, kind: 'hours', hours }
  if (minutes > 0) return { ...none, kind: 'custom', minutes }
  const at = AT_TIME.exec(schedule)
  if (at && Number(at[1]) < 60 && Number(at[2]) < 24) {
    const time = `${at[2].padStart(2, '0')}:${at[1].padStart(2, '0')}`
    if (at[3] === '*') return { ...none, kind: 'daily', time }
    if (at[3] === '1-5') return { ...none, kind: 'weekdays', time }
    return { ...none, kind: 'weekly', time, weekday: Number(at[3]) }
  }
  return { ...none, kind: 'custom' }
}

/** The form's fields for any schedule; one the form cannot show is kept as its own line. */
export function scheduleDraft(schedule: string): ScheduleDraft {
  const read = describeSchedule(schedule)
  return {
    kind: read.kind,
    time: read.time ?? DEFAULT_SCHEDULE.time,
    weekday: read.weekday ?? DEFAULT_SCHEDULE.weekday,
    hours: read.hours ?? DEFAULT_SCHEDULE.hours,
    custom: read.kind === 'custom' ? schedule : ''
  }
}

// 2023-01-01 was a Sunday, so day N of that week is cron's weekday N.
export function weekdayName(day: number): string {
  return new Intl.DateTimeFormat('en', { weekday: 'long', timeZone: 'UTC' }).format(
    Date.UTC(2023, 0, 1 + day)
  )
}

export function listRoutines(backend: RoutinesBackend, profile: string): Promise<Routine[]> {
  return backend.listRoutines(profile)
}

export function setRoutineActive(
  backend: RoutinesBackend,
  profile: string,
  routine: { id: string; active: boolean }
): Promise<void> {
  return backend.setRoutineActive(profile, routine)
}

export function addRoutine(
  backend: RoutinesBackend,
  profile: string,
  draft: RoutineDraft
): Promise<void> {
  return backend.addRoutine(profile, {
    name: draft.name.trim(),
    schedule: composeSchedule(draft.schedule),
    instruction: draft.instruction.trim(),
    postsToChat: draft.postsToChat
  })
}

export function removeRoutine(
  backend: RoutinesBackend,
  profile: string,
  id: string
): Promise<void> {
  return backend.removeRoutine(profile, id)
}

export async function loadRoutine(
  backend: RoutinesBackend,
  profile: string,
  id: string
): Promise<RoutineDetails> {
  const { name, instruction, schedule, postsToChat, ...runs } = await backend.loadRoutine(
    profile,
    id
  )
  return { ...runs, draft: { name, instruction, schedule: scheduleDraft(schedule), postsToChat } }
}

export function listRoutineRuns(
  backend: RoutinesBackend,
  profile: string,
  id: string
): Promise<RoutineRun[]> {
  return backend.listRoutineRuns(profile, id)
}

export async function openRoutineRun(
  backend: RoutinesBackend,
  profile: string,
  run: RoutineRun
): Promise<RunOutput> {
  const error = run.reason || null
  if (!run.sessionId) return { output: run.preview, error }
  return { output: await backend.lastRunReply(profile, run.sessionId), error }
}

/** Sends only what changed, so a schedule the form cannot show is never rewritten. */
export async function saveRoutine(
  backend: Pick<RoutinesBackend, 'updateRoutine'>,
  profile: string,
  { id, before, after }: RoutineEdit
): Promise<void> {
  const schedule = composeSchedule(after.schedule)
  const name = after.name.trim()
  const instruction = after.instruction.trim()
  await backend.updateRoutine(profile, id, {
    ...(name !== before.name ? { name } : {}),
    ...(instruction !== before.instruction ? { instruction } : {}),
    ...(schedule !== composeSchedule(before.schedule) ? { schedule } : {}),
    ...(after.postsToChat !== before.postsToChat ? { postsToChat: after.postsToChat } : {})
  })
}

/** Fires the routine now; resolves once the engine has run it. */
export function runRoutine(backend: RoutinesBackend, profile: string, id: string): Promise<void> {
  return backend.runRoutine(profile, id)
}
