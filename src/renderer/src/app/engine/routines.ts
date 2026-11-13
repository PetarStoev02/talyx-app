import { z } from 'zod'
import { RosterError } from '@features/bots/roster'
import type { RoutineRun, RoutinesBackend, RunState } from '@features/bots/routines'
import type { TranslationKey } from '@shared/lib/i18n'
import { messageText } from '@shared/lib/messageText'
import type { EngineAccess } from './access'

// The engine's delivery token for "inject the run into this profile's Bot Chat".
const BOT_CHAT = 'bot-chat'
// The engine's token for "keep the run's output in the engine only".
const LOCAL = 'local'
// How the engine ends a run session that finished.
const RUN_COMPLETE = 'cron_complete'
const RECENT_RUNS = 5
// Run now waits for the run itself, which can take a few minutes.
const RUN_TIMEOUT_MS = 600_000
// How the engine marks a script-only run, which writes an output file and no session.
const SCRIPT_RUN = 'cron_output'
// How the engine titles a script-only run that did not complete.
const SCRIPT_STOPPED = /^(FAILED|CANCELLED|MISSED) · /
// The most the engine pages at once: a run's last reply can sit behind many tool calls.
const RUN_TAIL = 500

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
        id: z.string(),
        source: z.string().nullish(),
        preview: z.string().nullish(),
        started_at: z.number().nullish(),
        is_active: z.boolean().nullish(),
        end_reason: z.string().nullish(),
        title: z.string().nullish()
      })
    )
    .nullish()
})
const messagesSchema = z.object({
  messages: z.array(z.object({ role: z.string().nullish(), content: z.unknown() })).nullish()
})
const outcomeSchema = z.object({ success: z.boolean().nullish(), error: z.string().nullish() })

/** A bot's routines over the engine: the cron tool on the socket, its jobs and runs over REST. */
export function engineRoutinesBackend(engine: EngineAccess): RoutinesBackend {
  return {
    listRoutines: async (profile) => {
      const { jobs } = listSchema.parse(
        await manage(engine, profile, { action: 'list', include_disabled: true })
      )
      return (jobs ?? []).map((job) => ({
        id: job.job_id,
        name: job.name || job.job_id,
        schedule: job.schedule ?? '',
        active: job.enabled !== false && job.state !== 'paused',
        postsToChat: job.deliver?.startsWith(BOT_CHAT) ?? false
      }))
    },
    addRoutine: async (profile, { name, schedule, instruction, postsToChat }) => {
      await manage(engine, profile, {
        action: 'add',
        name,
        schedule,
        prompt: instruction,
        ...(postsToChat ? { deliver: BOT_CHAT } : {})
      })
    },
    removeRoutine: async (profile, id) => {
      await manage(engine, profile, { action: 'remove', name: id })
    },
    setRoutineActive: async (profile, { id, active }) => {
      await manage(engine, profile, { action: active ? 'resume' : 'pause', name: id })
    },
    loadRoutine: async (profile, id) => {
      const job = detailsSchema.parse(await engine.http({ path: jobPath(profile, id), profile }))
      return {
        id: job.id,
        name: job.name || job.id,
        instruction: job.prompt ?? '',
        schedule: scheduleLine(job),
        postsToChat: job.deliver?.startsWith(BOT_CHAT) ?? false,
        active: job.enabled !== false && job.state !== 'paused',
        nextRunAt: job.next_run_at ?? null,
        lastRunAt: job.last_run_at ?? null,
        lastStatus: job.last_status ?? null,
        lastError: job.last_error ?? null
      }
    },
    updateRoutine: async (profile, id, { name, instruction, schedule, postsToChat }) => {
      const updates = {
        ...(name !== undefined ? { name } : {}),
        ...(instruction !== undefined ? { prompt: instruction } : {}),
        ...(schedule !== undefined ? { schedule } : {}),
        ...(postsToChat !== undefined ? { deliver: postsToChat ? BOT_CHAT : LOCAL } : {})
      }
      await refused('routines.errorSave', () =>
        engine.http({ path: jobPath(profile, id), method: 'PUT', body: { updates }, profile })
      )
    },
    listRoutineRuns: async (profile, id) => {
      const { runs } = runsSchema.parse(
        await engine.http({
          path: jobPath(profile, id, '/runs', { limit: String(RECENT_RUNS) }),
          profile
        })
      )
      return (runs ?? []).slice(0, RECENT_RUNS).map(runOf)
    },
    lastRunReply: async (profile, sessionId) => {
      const query = new URLSearchParams({ profile, order: 'latest', limit: String(RUN_TAIL) })
      const path = `/api/sessions/${encodeURIComponent(sessionId)}/messages?${query}`
      const { messages } = await refused('routines.errorRunOutput', async () =>
        messagesSchema.parse(await engine.http({ path, profile }))
      )
      const replies = (messages ?? [])
        .filter((message) => message.role === 'assistant')
        .map((message) => messageText(message.content).trim())
        .filter(Boolean)
      return replies.at(-1) ?? null
    },
    runRoutine: async (profile, id) => {
      await refused('routines.errorRun', () =>
        engine.http({
          path: jobPath(profile, id, '/trigger'),
          method: 'POST',
          profile,
          timeoutMs: RUN_TIMEOUT_MS
        })
      )
    }
  }
}

function runOf(run: NonNullable<z.infer<typeof runsSchema>['runs']>[number]): RoutineRun {
  const script = run.source === SCRIPT_RUN
  // A script-only run has no session: its title carries the outcome.
  const finished = script ? !SCRIPT_STOPPED.test(run.title ?? '') : run.end_reason === RUN_COMPLETE
  const state: RunState = run.is_active ? 'running' : finished ? 'finished' : 'stopped'
  // A script-only run's title carries its outcome; a session's title is only its name.
  const said = script ? run.title : run.end_reason
  const reason = state === 'stopped' ? (said ?? '') : ''
  return {
    id: run.id,
    sessionId: script ? null : run.id,
    startedAt: run.started_at ?? 0,
    state,
    reason,
    preview: script ? (run.preview ?? null) : null
  }
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

async function refused<T>(key: TranslationKey, call: () => Promise<T>): Promise<T> {
  try {
    return await call()
  } catch (error) {
    throw new RosterError(key, error instanceof Error ? error.message : String(error))
  }
}

// The cron tool reports its own failures inside a successful RPC result.
async function manage(
  engine: EngineAccess,
  profile: string,
  params: Record<string, unknown>
): Promise<unknown> {
  const result = await engine.request(profile, 'cron.manage', params)
  const outcome = outcomeSchema.safeParse(result)
  if (outcome.success && (outcome.data.success === false || outcome.data.error))
    throw new RosterError('routines.errorEngine', outcome.data.error ?? null)
  return result
}
