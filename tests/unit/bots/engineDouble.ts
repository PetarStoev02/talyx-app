import { expect } from 'vitest'
import type { RosterBackend, RosterRequest } from '../../../src/renderer/src/features/bots/data'
import type { EngineHttp } from '../../../src/renderer/src/shared/engine/http'
import type { CustomEndpoint } from '../../../src/renderer/src/shared/engine/types'
import type { ModelChoice } from '../../../src/renderer/src/features/bots/details'
import type { Look } from '../../../src/renderer/src/features/bots/look'
import type { Room } from '../../../src/renderer/src/features/bots/types'

export const BOT_META_KEY = 'acme-bots'
export const GROUPS_META_KEY = 'acme-bots-groups'

export interface ProfileState {
  description: string
  soul: string
  model: ModelChoice | null
}

export interface CronJob {
  job_id: string
  name: string
  schedule: string
  prompt: string
  deliver?: string
  enabled: boolean
  state: string
  next_run_at?: string | null
  last_run_at?: string | null
  last_status?: string | null
  last_error?: string | null
  runs?: { started_at: number; is_active: boolean; end_reason: string | null; title: string }[]
}

type Section = 'soul' | 'description' | 'model'

/** Talyx's own custom endpoint, the URL a bare `custom` pick needs. */
export const HOME_ENDPOINT = 'http://127.0.0.1:20128/v1'
/** How the engine shows Talyx's endpoint key kept in an environment variable. */
export const HOME_KEY_REF = '${ROUTER_API_KEY}'

export interface EngineDouble {
  request: RosterRequest
  http: EngineHttp
  /** Every model pin (POST /api/model/set), with its profile, in order. */
  modelSets: Record<string, unknown>[]
  /** The provider Talyx's own model is on; a bare custom pick copies its URL only from custom. */
  homeProvider: string
  /** Each profile's prompt setting (`agent.system_prompt`); absent when it has none. */
  prompts: Record<string, unknown>
  /** Every profile whose prompt setting was written, in order. */
  promptWrites: string[]
  /** Each profile's default reasoning (`agent.reasoning_effort`), once written. */
  reasoning: Record<string, string>
  /** Each profile's named endpoints (its config's providers), as the endpoint list shows them. */
  named: Record<string, CustomEndpoint[]>
  /** The engine's preview of Talyx's endpoint key: a `${VAR}` reference, or a redacted key. */
  homeKeyPreview: string
  metadata: Record<string, Record<string, unknown>>
  profiles: Record<string, ProfileState>
  jobs: Record<string, CronJob[]>
  configureCalls: string[]
  /** Every profiles.configure call that set something other than ui_meta, in order. */
  configured: Record<string, unknown>[]
  created: Record<string, unknown>[]
  cronCalls: { profile: string; params: Record<string, unknown> }[]
  expensiveModels: Set<string>
  deleted: string[]
  conflictOnce: () => void
  failSection: (section: Section) => void
  failCronOnce: (error: string) => void
  /** The next cron REST call fails as the engine's HTTP error does. */
  refuseCronOnce: (detail: string) => void
  /** Every cron REST call that changed something, in order. */
  cronWrites: { method: string; path: string; body?: unknown }[]
  failMetaOnce: () => void
  rooms: Room[]
  /** Each room's log rows, as groups.log pages them; groups.send adds the user's message. */
  roomLogs: Record<string, RoomLogRow[]>
  /** Every profiles.set_asset call, in order. */
  assets: { profile: string; params: Record<string, unknown> }[]
  failAssetOnce: () => void
  // What groups.capabilities says the engine will seat; null when it does not say.
  seatable: string[] | null
}

export interface RoomLogRow {
  seq: number
  event_id: string
  kind: string
  actor: { kind: string; id: string; display_name?: string }
  payload: Record<string, unknown>
  created_at: number
}

/** What the double's renderer returns for a look, so a test can tell which look was exported. */
export const pngOf = (look: Look): string =>
  `data:image/png;base64,${look.shape}-${look.hue}-${look.faces ? 'face' : 'plain'}`

interface NamedEntry {
  name: string
  base_url: string
  model: string
  models: Record<string, object>
  discover_models: boolean
  key_env?: string
}

/** A named endpoint as the engine's list shows it: its key only as its variable. */
export function namedEndpoint(id: string, entry: NamedEntry): CustomEndpoint {
  return {
    id,
    name: entry.name,
    base_url: entry.base_url,
    model: entry.model,
    models: Object.keys(entry.models),
    discover_models: entry.discover_models,
    has_api_key: !!entry.key_env,
    api_key_preview: entry.key_env ? `\${${entry.key_env}}` : null,
    source: 'providers'
  }
}

const blank = (): ProfileState => ({ description: '', soul: '', model: null })

// In-memory engine: profiles.list/describe/create/configure/set_asset, groups.list/capabilities/create/
// disband and cron.manage.
export function engineDouble(
  metadata: Record<string, Record<string, unknown>> = {
    default: {},
    analyst: {
      [BOT_META_KEY]: { title: 'Analyst', sectionId: 'team', sectionName: 'Team', color: 4 }
    }
  },
  rooms: Room[] = [{ room_id: 'room', name: 'Team room', members: [{ profile: 'analyst' }] }]
): EngineDouble {
  const revisions: Record<string, Record<string, number>> = Object.fromEntries(
    Object.entries(metadata).map(([name, meta]) => [
      name,
      Object.fromEntries(Object.keys(meta).map((key) => [key, 1]))
    ])
  )
  const profiles: Record<string, ProfileState> = Object.fromEntries(
    Object.keys(metadata).map((name) => [name, blank()])
  )
  if (profiles.analyst)
    profiles.analyst = {
      description: 'Numbers',
      soul: '# Analyst',
      model: { provider: 'custom', model: '9-route-provider' }
    }
  const jobs: Record<string, CronJob[]> = {}
  const configureCalls: string[] = []
  const configured: Record<string, unknown>[] = []
  const created: Record<string, unknown>[] = []
  const cronCalls: EngineDouble['cronCalls'] = []
  const expensiveModels = new Set<string>()
  const deleted: string[] = []
  const failing = new Set<Section>()
  let conflict = false
  let cronFailure: string | null = null
  let cronRefusal: string | null = null
  const cronWrites: EngineDouble['cronWrites'] = []
  let metaFailure = false
  let assetFailure = false
  const assets: EngineDouble['assets'] = []
  const modelSets: Record<string, unknown>[] = []
  const named: EngineDouble['named'] = {}
  const prompts: EngineDouble['prompts'] = {}
  const promptWrites: string[] = []
  const reasoning: EngineDouble['reasoning'] = {}

  // As the engine: a costly model waits for a yes, and a bare custom provider needs its URL.
  function setModel(profile: string, body: Record<string, unknown>): unknown {
    modelSets.push({ profile, ...structuredClone(body) })
    const { provider, model } = body as { provider: string; model: string }
    if (expensiveModels.has(model) && body.confirm_expensive_model !== true)
      return { ok: false, confirm_required: true, confirm_message: 'Costs more' }
    if (failing.has('model')) throw new Error('Engine HTTP 400: model switch rejected')
    if (provider === 'custom' && !body.base_url)
      throw new Error('Engine HTTP 400: custom provider needs a base_url')
    const namedIds = Object.values(named).flatMap((list) => list.map((item) => item.id))
    if (namedIds.includes(provider) && !named[profile]?.some((item) => item.id === provider))
      throw new Error(`Engine HTTP 400: Unknown provider '${provider}'`)
    profiles[profile].model = { provider, model }
    return { ok: true, scope: 'main', provider, model }
  }

  const http = async <T>(request: {
    path: string
    method?: string
    body?: unknown
    profile?: string
  }): Promise<T> => {
    const profile = new URL(request.path, 'http://engine').searchParams.get('profile') ?? ''
    if (request.path.startsWith('/api/model/set'))
      return setModel(profile, request.body as Record<string, unknown>) as T
    if (request.path.startsWith('/api/config')) {
      if (!metadata[profile]) throw new Error(`Engine HTTP 404: no profile ${profile}`)
      if (request.method !== 'PUT')
        return (profile in prompts ? { agent: { system_prompt: prompts[profile] } } : {}) as T
      const { providers, agent } = (
        request.body as {
          config: {
            providers?: Record<string, NamedEntry>
            agent?: { system_prompt?: string; reasoning_effort?: string }
          }
        }
      ).config
      for (const [id, entry] of Object.entries(providers ?? {}))
        named[profile] = [...(named[profile] ?? []), namedEndpoint(id, entry)]
      if (agent?.system_prompt !== undefined) {
        prompts[profile] = agent.system_prompt
        promptWrites.push(profile)
      }
      if (agent?.reasoning_effort !== undefined) reasoning[profile] = agent.reasoning_effort
      return { ok: true } as T
    }
    if (request.path.startsWith('/api/cron/jobs/')) return cronRest(profile, request) as T
    if (request.path.startsWith('/api/providers/custom-endpoints')) {
      const custom = double.homeProvider === 'custom' && profile === 'default'
      return {
        endpoints: [
          ...(named[profile] ?? []),
          ...(custom
            ? [
                {
                  id: 'custom',
                  name: 'Custom',
                  base_url: HOME_ENDPOINT,
                  model: '9-route-provider',
                  models: ['9-route-provider'],
                  discover_models: true,
                  has_api_key: true,
                  is_current: true,
                  api_key_preview: double.homeKeyPreview,
                  source: 'direct-config'
                }
              ]
            : [])
        ],
        current: {
          provider: double.homeProvider,
          model: '9-route-provider',
          base_url: custom ? HOME_ENDPOINT : ''
        }
      } as T
    }
    throw new Error(`Unexpected REST call ${request.path}`)
  }

  // As the engine: one call writes every key it carries, or none when any revision is stale.
  function configureMeta(profile: string, params: Record<string, unknown>): unknown {
    const patch = params.ui_meta as Record<string, unknown>
    const keys = Object.keys(patch)
    const [key] = keys
    configureCalls.push(`${profile}:${keys.join('+')}`)
    if (metaFailure) {
      metaFailure = false
      throw new Error('Socket closed')
    }
    if (conflict) {
      conflict = false
      metadata[profile][key] = { ...(metadata[profile][key] as object), title: 'Renamed elsewhere' }
      revisions[profile][key] = (revisions[profile][key] ?? 0) + 1
      return { applied: { ui_meta: false, ui_meta_conflicts: { [key]: revisions[profile][key] } } }
    }
    for (const each of keys)
      expect((params.ui_meta_expected_revisions as Record<string, number>)[each]).toBe(
        revisions[profile][each] ?? 0
      )
    for (const each of keys) {
      metadata[profile][each] = structuredClone(patch[each])
      revisions[profile][each] = (revisions[profile][each] ?? 0) + 1
    }
    return { applied: { ui_meta: true } }
  }

  function configureSections(params: Record<string, unknown>): unknown {
    configured.push(structuredClone(params))
    const state = profiles[params.name as string]
    const applied: Record<string, boolean> = {}
    const apply = (section: Section, write: () => void): void => {
      applied[section] = !failing.has(section)
      if (applied[section]) write()
    }
    if (typeof params.description === 'string')
      apply('description', () => (state.description = params.description as string))
    if (typeof params.soul === 'string') apply('soul', () => (state.soul = params.soul as string))
    if (params.model !== undefined) throw new Error('A model goes through /api/model/set')
    return { ok: Object.values(applied).every(Boolean), applied }
  }

  function createProfile(params: Record<string, unknown>): unknown {
    const name = params.name as string
    if (name === 'reserved') throw new Error('Profile name is reserved')
    if (metadata[name]) throw new Error(`Profile '${name}' already exists`)
    created.push(structuredClone(params))
    metadata[name] = {}
    revisions[name] = {}
    // Without a model the engine gives the new profile Talyx's own.
    profiles[name] = {
      description: '',
      soul: (params.soul as string) ?? '',
      model: { provider: 'custom', model: '9-route-provider' }
    }
    return { ok: true, name, path: `/profiles/${name}`, mirrored: {} }
  }

  function manageCron(profile: string, params: Record<string, unknown>): unknown {
    cronCalls.push({ profile, params: structuredClone(params) })
    if (cronFailure) {
      const error = cronFailure
      cronFailure = null
      return { success: false, error }
    }
    const list = (jobs[profile] ??= [])
    const job = list.find((item) => item.job_id === params.name)
    switch (params.action) {
      case 'list':
        return { success: true, jobs: structuredClone(list), scoped: profile }
      case 'add': {
        const added: CronJob = {
          job_id: `job-${list.length + 1}`,
          name: params.name as string,
          schedule: params.schedule as string,
          prompt: params.prompt as string,
          ...(params.deliver ? { deliver: params.deliver as string } : {}),
          enabled: true,
          state: 'scheduled'
        }
        list.push(added)
        return { success: true, job_id: added.job_id }
      }
      case 'pause':
      case 'resume':
        if (!job) return { success: false, error: 'Job not found' }
        job.enabled = params.action === 'resume'
        job.state = params.action === 'resume' ? 'scheduled' : 'paused'
        return { success: true }
      case 'remove':
        if (!job) return { success: false, error: 'Job not found' }
        list.splice(list.indexOf(job), 1)
        return { success: true }
      default:
        throw new Error(`Unexpected cron action ${String(params.action)}`)
    }
  }

  // As the engine's cron REST: a job's schedule comes back as its stored shape, not as typed.
  function cronRest(
    profile: string,
    request: { path: string; method?: string; body?: unknown }
  ): unknown {
    const method = request.method ?? 'GET'
    const [id, action] = new URL(request.path, 'http://engine').pathname
      .replace('/api/cron/jobs/', '')
      .split('/')
      .map(decodeURIComponent)
    if (method !== 'GET') cronWrites.push({ method, path: request.path, body: request.body })
    if (cronRefusal) {
      const detail = cronRefusal
      cronRefusal = null
      throw new Error(detail)
    }
    const job = jobs[profile]?.find((item) => item.job_id === id)
    if (!job) throw new Error('Job not found')
    if (action === 'runs') return { runs: structuredClone(job.runs ?? []), limit: 5 }
    if (action === 'trigger') {
      job.last_run_at = '2026-11-07T10:00:00+00:00'
      job.last_status = 'ok'
      job.last_error = null
      job.runs = [
        {
          started_at: 1_794_045_600,
          is_active: false,
          end_reason: 'cron_complete',
          title: 'Cash run'
        },
        ...(job.runs ?? [])
      ]
    }
    if (method === 'PUT') {
      const { updates } = request.body as { updates: Record<string, string> }
      if (updates.name !== undefined) job.name = updates.name
      if (updates.prompt !== undefined) job.prompt = updates.prompt
      if (updates.schedule !== undefined) job.schedule = updates.schedule
      if (updates.deliver !== undefined) job.deliver = updates.deliver
    }
    return storedJob(job)
  }

  function setAsset(profile: string, params: Record<string, unknown>): unknown {
    if (assetFailure) {
      assetFailure = false
      throw new Error('Asset store is read-only')
    }
    assets.push({ profile, params: structuredClone(params) })
    return { ok: true, asset: params.asset, size: String(params.data).length }
  }

  const request: RosterRequest = async (profile, method, params) => {
    if (method === 'profiles.list')
      return {
        profiles: Object.entries(metadata).map(([name, ui_meta]) => ({
          name,
          description: profiles[name]?.description ?? '',
          ui_meta: structuredClone(ui_meta),
          ui_meta_revisions: { ...revisions[name] }
        }))
      }
    if (method === 'groups.list') return { rooms: structuredClone(rooms), next_offset: null }
    if (method === 'groups.capabilities') return { seatable_profiles: double.seatable }
    if (method === 'groups.create') {
      const room = { room_id: params.room_id, name: params.name, members: params.members } as Room
      rooms.push(structuredClone(room))
      return { room }
    }
    if (method === 'groups.rename') {
      const room = rooms.find((item) => item.room_id === params.room_id)
      if (!room) throw new Error('Room not found')
      room.name = params.name as string
      return { room: structuredClone(room) }
    }
    if (method === 'groups.send') {
      const log = (double.roomLogs[params.room_id as string] ??= [])
      log.push({
        seq: log.length + 1,
        event_id: params.event_id as string,
        kind: 'message.user',
        actor: { kind: 'user', id: 'user' },
        payload: structuredClone(params.payload as Record<string, unknown>),
        created_at: 1_794_045_600 + log.length
      })
      return { event: { seq: log.length } }
    }
    if (method === 'groups.log') {
      // Two rows a page, so a test also reads past the first page.
      const since = params.since_seq as number
      const rows = (double.roomLogs[params.room_id as string] ?? []).filter(
        (row) => row.seq > since
      )
      const page = rows.slice(0, 2)
      return {
        events: structuredClone(page),
        cursor: page.at(-1)?.seq ?? since,
        has_more: rows.length > page.length
      }
    }
    if (method === 'groups.disband') {
      const index = rooms.findIndex((room) => room.room_id === params.room_id)
      if (index < 0) throw new Error('Room not found')
      rooms.splice(index, 1)
      return { tombstone: { room_id: params.room_id } }
    }
    if (method === 'profiles.describe') {
      const state = profiles[params.name as string]
      if (!state) throw new Error('Profile not found')
      return {
        name: params.name,
        description: state.description,
        soul: state.soul,
        model: { provider: state.model?.provider ?? '', default: state.model?.model ?? '' }
      }
    }
    if (method === 'profiles.create') return createProfile(params)
    if (method === 'cron.manage') return manageCron(profile, params)
    if (method === 'profiles.set_asset') return setAsset(profile, params)
    if (method !== 'profiles.configure') throw new Error(`Unexpected method ${method}`)
    return params.ui_meta ? configureMeta(profile, params) : configureSections(params)
  }
  const double: EngineDouble = {
    request,
    http: http as EngineHttp,
    modelSets,
    named,
    prompts,
    promptWrites,
    reasoning,
    homeProvider: 'custom',
    homeKeyPreview: HOME_KEY_REF,
    rooms,
    roomLogs: {},
    assets,
    seatable: null,
    metadata,
    profiles,
    jobs,
    configureCalls,
    configured,
    created,
    cronCalls,
    expensiveModels,
    deleted,
    conflictOnce: () => {
      conflict = true
    },
    failSection: (section) => failing.add(section),
    failCronOnce: (error) => {
      cronFailure = error
    },
    refuseCronOnce: (detail) => {
      cronRefusal = detail
    },
    cronWrites,
    failMetaOnce: () => {
      metaFailure = true
    },
    failAssetOnce: () => {
      assetFailure = true
    }
  }
  return double
}

function storedJob(job: CronJob): Record<string, unknown> {
  const every = /^every (\d+)([mh])$/.exec(job.schedule)
  const schedule = every
    ? { kind: 'interval', minutes: Number(every[1]) * (every[2] === 'h' ? 60 : 1) }
    : /^\d{4}-/.test(job.schedule)
      ? { kind: 'once', run_at: job.schedule }
      : { kind: 'cron', expr: job.schedule }
  return {
    id: job.job_id,
    name: job.name,
    prompt: job.prompt,
    schedule: { ...schedule, display: job.schedule },
    schedule_display: job.schedule,
    deliver: job.deliver ?? 'local',
    enabled: job.enabled,
    state: job.state,
    next_run_at: job.next_run_at ?? null,
    last_run_at: job.last_run_at ?? null,
    last_status: job.last_status ?? null,
    last_error: job.last_error ?? null
  }
}

export function backendFor(
  engine: Pick<EngineDouble, 'request'> & Partial<EngineDouble>
): RosterBackend {
  return {
    request: engine.request,
    http:
      engine.http ??
      (() => {
        throw new Error('Not used')
      }),
    botMetaKey: BOT_META_KEY,
    botGroupsMetaKey: GROUPS_META_KEY,
    deleteProfile: async (profile) => {
      if (!engine.metadata || !engine.deleted) throw new Error('Not used')
      delete engine.metadata[profile]
      engine.deleted.push(profile)
    },
    avatarPng: async (look) => pngOf(look),
    setRoomMembers: async (roomId, members) => {
      const room = engine.rooms?.find((item) => item.room_id === roomId)
      if (!room) throw new Error('Room not found')
      room.members = structuredClone(members)
    }
  }
}
