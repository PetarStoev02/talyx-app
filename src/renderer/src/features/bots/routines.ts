import { z } from 'zod'
import type { RosterBackend } from './data'
import { RosterError } from './roster'
import type { TranslationKey } from '@shared/lib/i18n'

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
  /** Seconds since the epoch. */
  startedAt: number
  state: RunState
  /** Why a run that did not finish stopped, as the engine says it; empty otherwise. */
  reason: string
}

export type RunState = 'running' | 'finished' | 'stopped'

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

// The engine's delivery token for "inject the run into this profile's Bot Chat".
const BOT_CHAT = 'bot-chat'
// The engine's token for "keep the run's output in the engine only".
const LOCAL = 'local'
// How the engine ends a run session that finished.
const RUN_COMPLETE = 'cron_complete'
const AT_TIME = /^(\d{1,2}) (\d{1,2}) \* \* (\*|1-5|[0-6])$/
const EVERY_HOURS = /^every (\d+)h$/
// How the engine stores an interval ("every 2h" comes back as "every 120m"), and a cron step.
const EVERY_MINUTES = /^every (\d+)m$/
const CRON_MINUTES = /^\*\/(\d{1,2}) \* \* \* \*$/
const MINUTES_PER_HOUR = 60
export const MAX_HOURS = 24
const RECENT_RUNS = 5
// Run now waits for the run itself, which can take a few minutes.
const RUN_TIMEOUT_MS = 600_000

const listSchema = z.object({
  jobs: z
    .array(
      z.object({
        job_id: z.string(),
        name: z.string().nullish(),
        schedule: z.string().nullish(),
        deliver: z.string().nullish(),
        enabled: z.boolean().nullish(),
        state: z.string().nullish()
      })
    )
    .nullish()
})
const detailsSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  prompt: z.string().nullish(),
  schedule: z
    .object({
      kind: z.string().nullish(),
      expr: z.string().nullish(),
      minutes: z.number().nullish(),
      run_at: z.string().nullish()
    })
    .nullish(),
  schedule_display: z.string().nullish(),
  deliver: z.string().nullish(),
  enabled: z.boolean().nullish(),
  state: z.string().nullish(),
  next_run_at: z.string().nullish(),
  last_run_at: z.string().nullish(),
  last_status: z.string().nullish(),
  last_error: z.string().nullish()
})
const runsSchema = z.object({
  runs: z
    .array(
      z.object({
        started_at: z.number().nullish(),
        is_active: z.boolean().nullish(),
        end_reason: z.string().nullish(),
        title: z.string().nullish()
      })
    )
    .nullish()
})
const outcomeSchema = z.object({ success: z.boolean().nullish(), error: z.string().nullish() })

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

export async function listRoutines(backend: RosterBackend, profile: string): Promise<Routine[]> {
  const { jobs } = listSchema.parse(
    await manage(backend, profile, { action: 'list', include_disabled: true })
  )
  return (jobs ?? []).map((job) => ({
    id: job.job_id,
    name: job.name || job.job_id,
    schedule: job.schedule ?? '',
    active: job.enabled !== false && job.state !== 'paused',
    postsToChat: job.deliver?.startsWith(BOT_CHAT) ?? false
  }))
}

export async function setRoutineActive(
  backend: RosterBackend,
  profile: string,
  routine: { id: string; active: boolean }
): Promise<void> {
  await manage(backend, profile, {
    action: routine.active ? 'resume' : 'pause',
    name: routine.id
  })
}

export async function addRoutine(
  backend: RosterBackend,
  profile: string,
  draft: RoutineDraft
): Promise<void> {
  await manage(backend, profile, {
    action: 'add',
    name: draft.name.trim(),
    schedule: composeSchedule(draft.schedule),
    prompt: draft.instruction.trim(),
    ...(draft.postsToChat ? { deliver: BOT_CHAT } : {})
  })
}

export async function removeRoutine(
  backend: RosterBackend,
  profile: string,
  id: string
): Promise<void> {
  await manage(backend, profile, { action: 'remove', name: id })
}

export async function loadRoutine(
  backend: RosterBackend,
  profile: string,
  id: string
): Promise<RoutineDetails> {
  const job = detailsSchema.parse(await backend.http({ path: jobPath(profile, id), profile }))
  return {
    id: job.id,
    draft: {
      name: job.name || job.id,
      instruction: job.prompt ?? '',
      schedule: scheduleDraft(scheduleLine(job)),
      postsToChat: job.deliver?.startsWith(BOT_CHAT) ?? false
    },
    active: job.enabled !== false && job.state !== 'paused',
    nextRunAt: job.next_run_at ?? null,
    lastRunAt: job.last_run_at ?? null,
    lastStatus: job.last_status ?? null,
    lastError: job.last_error ?? null
  }
}

export async function listRoutineRuns(
  backend: RosterBackend,
  profile: string,
  id: string
): Promise<RoutineRun[]> {
  const { runs } = runsSchema.parse(
    await backend.http({
      path: jobPath(profile, id, '/runs', { limit: String(RECENT_RUNS) }),
      profile
    })
  )
  return (runs ?? []).slice(0, RECENT_RUNS).map((run) => {
    const state: RunState = run.is_active
      ? 'running'
      : run.end_reason === RUN_COMPLETE
        ? 'finished'
        : 'stopped'
    // A script-only run has no session: its title carries the outcome.
    const reason = state === 'stopped' ? (run.end_reason ?? run.title ?? '') : ''
    return { startedAt: run.started_at ?? 0, state, reason }
  })
}

/** Sends only what changed, so a schedule the form cannot show is never rewritten. */
export async function saveRoutine(
  backend: RosterBackend,
  profile: string,
  { id, before, after }: RoutineEdit
): Promise<void> {
  const schedule = composeSchedule(after.schedule)
  const name = after.name.trim()
  const prompt = after.instruction.trim()
  const updates = {
    ...(name !== before.name ? { name } : {}),
    ...(prompt !== before.instruction ? { prompt } : {}),
    ...(schedule !== composeSchedule(before.schedule) ? { schedule } : {}),
    ...(after.postsToChat !== before.postsToChat
      ? { deliver: after.postsToChat ? BOT_CHAT : LOCAL }
      : {})
  }
  await refused('routines.errorSave', () =>
    backend.http({ path: jobPath(profile, id), method: 'PUT', body: { updates }, profile })
  )
}

/** Fires the routine now; resolves once the engine has run it. */
export async function runRoutine(
  backend: RosterBackend,
  profile: string,
  id: string
): Promise<void> {
  await refused('routines.errorRun', () =>
    backend.http({
      path: jobPath(profile, id, '/trigger'),
      method: 'POST',
      profile,
      timeoutMs: RUN_TIMEOUT_MS
    })
  )
}

// The line the engine parses back to the same schedule; its display text is not always one.
function scheduleLine(job: z.infer<typeof detailsSchema>): string {
  const { kind, expr, minutes, run_at } = job.schedule ?? {}
  if (kind === 'cron' && expr) return expr
  if (kind === 'interval' && minutes) return `every ${minutes}m`
  if (kind === 'once' && run_at) return run_at
  return job.schedule_display ?? ''
}

function jobPath(
  profile: string,
  id: string,
  suffix = '',
  query: Record<string, string> = {}
): string {
  const search = new URLSearchParams({ profile, ...query })
  return `/api/cron/jobs/${encodeURIComponent(id)}${suffix}?${search}`
}

async function refused(key: TranslationKey, call: () => Promise<unknown>): Promise<void> {
  try {
    await call()
  } catch (error) {
    throw new RosterError(key, error instanceof Error ? error.message : String(error))
  }
}

// The cron tool reports its own failures inside a successful RPC result.
async function manage(
  backend: RosterBackend,
  profile: string,
  params: Record<string, unknown>
): Promise<unknown> {
  const result = await backend.request(profile, 'cron.manage', params)
  const outcome = outcomeSchema.safeParse(result)
  if (outcome.success && (outcome.data.success === false || outcome.data.error))
    throw new RosterError('routines.errorEngine', outcome.data.error ?? null)
  return result
}
