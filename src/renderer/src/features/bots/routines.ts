import { z } from 'zod'
import type { RosterBackend } from './data'
import { RosterError } from './roster'

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

export const DEFAULT_SCHEDULE: ScheduleDraft = {
  kind: 'daily',
  time: '09:00',
  weekday: 1,
  hours: 1,
  custom: ''
}

// The engine's delivery token for "inject the run into this profile's Bot Chat".
const BOT_CHAT = 'bot-chat'
const AT_TIME = /^(\d{1,2}) (\d{1,2}) \* \* (\*|1-5|[0-6])$/
const EVERY_HOURS = /^every (\d+)h$/

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

/** The inverse of composeSchedule for the forms it writes; anything else reads as custom. */
export function describeSchedule(schedule: string): {
  kind: ScheduleKind
  time: string | null
  weekday: number | null
  hours: number | null
} {
  const hours = EVERY_HOURS.exec(schedule)
  if (hours) return { kind: 'hours', time: null, weekday: null, hours: Number(hours[1]) }
  const at = AT_TIME.exec(schedule)
  if (at && Number(at[1]) < 60 && Number(at[2]) < 24) {
    const time = `${at[2].padStart(2, '0')}:${at[1].padStart(2, '0')}`
    if (at[3] === '*') return { kind: 'daily', time, weekday: null, hours: null }
    if (at[3] === '1-5') return { kind: 'weekdays', time, weekday: null, hours: null }
    return { kind: 'weekly', time, weekday: Number(at[3]), hours: null }
  }
  return { kind: 'custom', time: null, weekday: null, hours: null }
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
