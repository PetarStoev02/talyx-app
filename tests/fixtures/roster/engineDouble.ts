import { useEngine } from '../../../src/renderer/src/app/providers/useEngine'
import { useRoster } from '../../../src/renderer/src/features/bots/store'
import type { RosterBackend, RosterRequest } from '../../../src/renderer/src/features/bots/data'
import type { EngineApiRequest } from '../../../src/renderer/src/shared/engine/http'
import { blockPng } from '../../../src/renderer/src/shared/ui/blockPng'
import { EXPECTED_ENGINE_VERSION, type EngineStatus } from '../../../src/shared/engine'
import { fixtureChat } from './fixtureChat'
import { COSTLY_MODEL, DEFAULT_MODEL, fixtureProviders, PROVIDER } from './fixtureProviders'
import { roomRequest, roomSessionRequest, setRoomMembers } from './fixtureRooms'

// The in-memory engine the roster fixture and the website's live demo both run on. Deliberately
// in-memory: it never connects to or modifies user profiles, and a reload resets it.

const BOT_META_KEY = 'acme-bots'
const INSTALLED_PATH = '/Users/fixture/.local/bin/talyx-engine'

// Saved looks: one in today's values, one from an older client (read as the nearest block).
// Every other bot matches its name.
const LOOKS: Record<string, Record<string, unknown>> = {
  writer: { shape: 'tower', color: 2, faces: false },
  designer: { shape: 'blobatar:fixture1', color: 'hsl(150 68% 58%)', imageKind: 'shape' }
}

// What each bot is for, what it last said, and its SOUL's one line.
const BOTS: Record<string, { description: string; preview: string; soul: string }> = {
  default: {
    description: 'Hands work to the right bot and briefs you.',
    preview: 'Q3 margins are up 4 points, to 41%.',
    soul: 'You run the team. Send each task to the bot that fits, then brief the user.'
  },
  researcher: {
    description: 'Finds sources and sums them up.',
    preview: 'Reading six reports on EU battery rules.',
    soul: 'You find primary sources, check them against each other and sum them up with links.'
  },
  designer: {
    description: 'Sketches layouts and reviews visuals.',
    preview: 'Two landing page layouts are ready to compare.',
    soul: 'You sketch layouts and give visual feedback that names the fix, not just the problem.'
  },
  writer: {
    description: 'Drafts posts, emails and release notes.',
    preview: 'The launch post is ready for your edits.',
    soul: 'You write short, plain drafts in the house voice and mark anything you were unsure of.'
  },
  planner: {
    description: 'Turns goals into dated plans.',
    preview: 'The Q4 plan has three milestones and two open risks.',
    soul: 'You turn a goal into milestones with dates, owners and the risks that could move them.'
  },
  analyst: {
    description: 'Reads the numbers and says what moved.',
    preview: 'Which regions should the report cover?',
    soul: 'You read the numbers and lead with what changed, then why, in plain words.'
  },
  reviewer: {
    description: 'Checks drafts and code before they ship.',
    preview: 'Left four comments on the onboarding email.',
    soul: 'You review work before it ships and list what must change before what could.'
  },
  developer: {
    description: 'Writes and fixes code in your repos.',
    preview: 'Fixed the CSV export; the tests pass.',
    soul: 'You make small, tested changes and explain each one in a sentence.'
  },
  support: {
    description: 'Answers customer questions from the help docs.',
    preview: 'Answered 12 tickets; two need a refund decision.',
    soul: 'You answer customers kindly from the help docs and hand anything else to a person.'
  },
  sales: {
    description: 'Qualifies leads and drafts follow-ups.',
    preview: "Drafted follow-ups for this week's five demos.",
    soul: 'You qualify leads against the ideal customer and draft follow-ups that ask one question.'
  },
  operations: {
    description: 'Keeps invoices, renewals and vendors on track.',
    preview: 'Three vendor renewals are due this month, all in budget.',
    soul: 'You track invoices, renewals and vendors, and flag anything due within two weeks.'
  }
}

/** The last avatar image each profile was given through profiles.set_asset. */
export const assets: Record<string, string> = {}

const titleOf = (name: string): string =>
  name === 'default' ? 'Talyx' : name[0].toUpperCase() + name.slice(1)

const profiles = Object.keys(BOTS).map((name, index) => ({
  name,
  ui_meta: {
    [BOT_META_KEY]: {
      title: titleOf(name),
      pinned: index < 2 || name === 'analyst',
      pinnedOrder: index,
      sectionId: index < 6 ? 'team' : 'delivery',
      sectionName: index < 6 ? 'Team' : 'Delivery',
      ...LOOKS[name]
    }
  } as Record<string, unknown>,
  ui_meta_revisions: { [BOT_META_KEY]: 1 } as Record<string, number>,
  last_session: {
    preview: BOTS[name].preview,
    last_active: Date.now() / 1000 - index * 120
  }
}))
const details: Record<
  string,
  { description: string; soul: string; provider: string; model: string }
> = Object.fromEntries(
  profiles.map(({ name }) => [
    name,
    {
      description: BOTS[name].description,
      soul: `# ${titleOf(name)}\n\n${BOTS[name].soul}`,
      provider: PROVIDER,
      model: DEFAULT_MODEL
    }
  ])
)
const jobs: Record<string, Record<string, unknown>[]> = {
  analyst: [
    {
      job_id: 'cash',
      name: 'Monday cash position',
      prompt: 'Post the cash position across our accounts and flag anything below the floor.',
      schedule: '0 8 * * 1',
      deliver: 'bot-chat',
      enabled: true,
      state: 'scheduled',
      next_run_at: '2026-11-09T08:00:00+00:00',
      last_run_at: '2026-11-02T08:00:00+00:00',
      last_status: 'ok',
      runs: [
        {
          id: 'cash-run-2',
          started_at: 1_793_606_400,
          is_active: false,
          end_reason: 'cron_complete',
          title: 'Cash run'
        },
        {
          id: 'cash-run-1',
          started_at: 1_793_001_600,
          is_active: false,
          end_reason: 'cron_incomplete_no_output',
          title: 'Cash run'
        }
      ]
    },
    {
      job_id: 'invoices',
      name: 'Invoice chase',
      prompt: 'List the invoices more than 30 days overdue and draft a reminder for each.',
      schedule: '0 17 * * *',
      enabled: false,
      state: 'paused',
      runs: [
        {
          id: 'cron_output:invoices:2026-11-05_17-00-00',
          source: 'cron_output',
          started_at: 1_793_890_800,
          is_active: false,
          end_reason: null,
          title: 'COMPLETED · Script-only run',
          preview:
            '# Cron Job: Invoice chase **Job ID:** invoices **Run Time:** 2026-11-05 17:00:00 ## Response Three invoices are more than 30 days overdue: INV-1042, INV-1057 and INV-1063. Reminder…'
        }
      ]
    }
  ]
}
let nextJob = 1
// Each routine run's session, as the engine stores it.
const runMessages: Record<string, { role: string; content: string }[]> = {
  'cash-run-2': [
    { role: 'user', content: 'Post the cash position across our accounts.' },
    {
      role: 'assistant',
      content:
        'Cash position, Monday 2 November:\n\n- Operating: 48,200 EUR\n- Payroll: 21,750 EUR\n- Reserve: 90,000 EUR\n\nAll accounts are above the floor.'
    }
  ],
  'cash-run-1': [{ role: 'user', content: 'Post the cash position across our accounts.' }]
}

function configure(profile: string, params: Record<string, unknown>): unknown {
  const bot = profiles.find((bot) => bot.name === profile)!
  if (!params.ui_meta) {
    const state = details[profile]
    const applied: Record<string, boolean> = {}
    if (typeof params.description === 'string') {
      state.description = params.description
      applied.description = true
    }
    if (typeof params.soul === 'string') {
      state.soul = params.soul
      applied.soul = true
    }
    return { ok: true, applied }
  }
  for (const [key, value] of Object.entries(params.ui_meta as Record<string, unknown>)) {
    bot.ui_meta[key] = value
    bot.ui_meta_revisions[key] = (bot.ui_meta_revisions[key] ?? 0) + 1
  }
  return { applied: { ui_meta: true } }
}

function manageCron(profile: string, params: Record<string, unknown>): unknown {
  const list = (jobs[profile] ??= [])
  const job = list.find((item) => item.job_id === params.name)
  if (params.action === 'list') return { success: true, jobs: structuredClone(list) }
  if (params.action === 'add') {
    list.push({
      job_id: `fixture-${nextJob++}`,
      name: params.name,
      schedule: params.schedule,
      deliver: params.deliver,
      enabled: true,
      state: 'scheduled'
    })
    return { success: true }
  }
  if (!job) return { success: false, error: 'Routine not found' }
  if (params.action === 'remove') list.splice(list.indexOf(job), 1)
  else {
    job.enabled = params.action === 'resume'
    job.state = params.action === 'resume' ? 'scheduled' : 'paused'
  }
  return { success: true }
}

function createProfile(params: Record<string, unknown>): unknown {
  const name = params.name as string
  if (profiles.some((bot) => bot.name === name)) throw new Error(`Profile '${name}' already exists`)
  profiles.push({
    name,
    ui_meta: {},
    ui_meta_revisions: {},
    last_session: { preview: '', last_active: 0 }
  })
  details[name] = {
    description: '',
    soul: params.soul as string,
    provider: PROVIDER,
    model: DEFAULT_MODEL
  }
  return { ok: true, name, path: `/fixture/${name}`, mirrored: {} }
}

const request: RosterRequest = async (profile, method, params) => {
  if (method === 'profiles.list')
    return {
      profiles: structuredClone(profiles).map((bot) => ({
        ...bot,
        description: details[bot.name]?.description ?? ''
      }))
    }
  if (method === 'profiles.describe') {
    const state = details[params.name as string]
    return {
      name: params.name,
      description: state.description,
      soul: state.soul,
      model: { provider: state.provider, default: state.model }
    }
  }
  if (method === 'profiles.configure') return configure(profile, params)
  if (method === 'profiles.create') return createProfile(params)
  if (method === 'cron.manage') return manageCron(profile, params)
  if (method.startsWith('groups.')) return roomRequest(method, params)
  const roomSession =
    (method.startsWith('session.') || method === 'config.set') &&
    roomSessionRequest(profile, method, params)
  if (roomSession) return roomSession
  if (method === 'profiles.set_asset') {
    assets[params.name as string] = params.data as string
    window.dispatchEvent(new Event('fixture-asset'))
    return { ok: true, asset: params.asset }
  }
  throw new Error('Unsupported fixture operation')
}

// As the engine's cron REST that the routine dialog reads and writes.
function cronRest(request: EngineApiRequest): unknown {
  const url = new URL(request.path, 'http://engine')
  const profile = url.searchParams.get('profile') ?? 'default'
  const [id, action] = url.pathname
    .replace('/api/cron/jobs/', '')
    .split('/')
    .map(decodeURIComponent)
  const job = jobs[profile]?.find((item) => item.job_id === id)
  if (!job) throw new Error('Job not found')
  if (action === 'runs') return { runs: structuredClone(job.runs ?? []), limit: 5 }
  if (action === 'trigger') {
    job.last_run_at = new Date().toISOString()
    job.last_status = 'ok'
    const id = `${job.job_id}-run-${Date.now()}`
    const run = { id, started_at: Date.now() / 1000, is_active: false, end_reason: 'cron_complete' }
    runMessages[id] = [
      { role: 'user', content: String(job.prompt) },
      { role: 'assistant', content: `Ran just now: ${String(job.name)} is done.` }
    ]
    job.runs = [{ ...run, title: `${job.name} run` }, ...((job.runs as unknown[]) ?? [])]
  }
  if (request.method === 'PUT')
    Object.assign(job, (request.body as { updates: Record<string, string> }).updates)
  return {
    id: job.job_id,
    name: job.name,
    prompt: job.prompt ?? '',
    schedule: { kind: 'cron', expr: job.schedule, display: job.schedule },
    schedule_display: job.schedule,
    deliver: job.deliver ?? 'local',
    enabled: job.enabled,
    state: job.state,
    next_run_at: job.next_run_at ?? null,
    last_run_at: job.last_run_at ?? null,
    last_status: job.last_status ?? null,
    last_error: null
  }
}

// A bot's model pin and a routine's details; every other call is the Providers page's double.
async function http<T>(request: EngineApiRequest): Promise<T> {
  if (request.path.startsWith('/api/cron/jobs/')) return cronRest(request) as T
  const run = /^\/api\/sessions\/([^/?]+)\/messages/.exec(request.path)?.[1]
  if (run && runMessages[decodeURIComponent(run)])
    return { messages: runMessages[decodeURIComponent(run)] } as T
  if (!request.path.startsWith('/api/model/set')) return providers.http<T>(request)
  const body = request.body as {
    provider: string
    model: string
    confirm_expensive_model?: boolean
  }
  if (body.model === COSTLY_MODEL && body.confirm_expensive_model !== true)
    return {
      ok: false,
      confirm_required: true,
      confirm_message: `${COSTLY_MODEL} costs more per turn.`
    } as T
  Object.assign(details[request.profile!], { provider: body.provider, model: body.model })
  return { ok: true } as T
}

async function deleteProfile(profile: string): Promise<void> {
  if (profile === 'default') throw new Error('Cannot delete the default profile')
  const index = profiles.findIndex((bot) => bot.name === profile)
  if (index >= 0) profiles.splice(index, 1)
}

export const rosterBackend: RosterBackend = {
  request,
  http,
  deleteProfile,
  botMetaKey: BOT_META_KEY,
  botGroupsMetaKey: `${BOT_META_KEY}-groups`,
  avatarPng: blockPng,
  setRoomMembers
}
export const providers = fixtureProviders(profiles.map((bot) => bot.name))
export const chat = fixtureChat(providers)

/** An attached engine as the fixture's pages need it. */
export function attachedEngine(
  version: string,
  path: string = INSTALLED_PATH
): Extract<EngineStatus, { state: 'attached' }> {
  return {
    state: 'attached',
    version,
    commit: null,
    home: '/fixture/engine',
    path,
    stale: false,
    botMetaKey: rosterBackend.botMetaKey,
    botGroupsMetaKey: rosterBackend.botGroupsMetaKey,
    managerHandle: 'acme'
  }
}

/** The Agents page waits for an attached engine and an open socket; the double says it has both. */
export function attachDouble(): void {
  useEngine.setState({
    status: attachedEngine(EXPECTED_ENGINE_VERSION),
    connection: 'open',
    everConnected: true
  })
  useRoster.getState().setActivity('researcher', 'working')
  useRoster.getState().setActivity('analyst', 'waiting')
  useRoster.getState().markUnread('writer')
}
