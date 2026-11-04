import { expect } from 'vitest'
import type { RosterBackend, RosterRequest } from '../../../src/renderer/src/features/bots/data'
import type { ModelChoice } from '../../../src/renderer/src/features/bots/details'
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
}

type Section = 'soul' | 'description' | 'model'

export interface EngineDouble {
  request: RosterRequest
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
  failMetaOnce: () => void
  rooms: Room[]
  // What groups.capabilities says the engine will seat; null when it does not say.
  seatable: string[] | null
}

const blank = (): ProfileState => ({ description: '', soul: '', model: null })

// In-memory engine: profiles.list/describe/create/configure, groups.list/capabilities/create/
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
  let metaFailure = false

  function configureMeta(profile: string, params: Record<string, unknown>): unknown {
    const patch = params.ui_meta as Record<string, unknown>
    const key = Object.keys(patch)[0]
    configureCalls.push(`${profile}:${key}`)
    if (metaFailure) {
      metaFailure = false
      throw new Error('Socket closed')
    }
    if (conflict) {
      conflict = false
      metadata[profile][key] = { ...(metadata[profile][key] as object), title: 'Renamed elsewhere' }
      revisions[profile][key]++
      return { applied: { ui_meta: false, ui_meta_conflicts: { [key]: revisions[profile][key] } } }
    }
    expect((params.ui_meta_expected_revisions as Record<string, number>)[key]).toBe(
      revisions[profile][key] ?? 0
    )
    metadata[profile][key] = structuredClone(patch[key])
    revisions[profile][key] = (revisions[profile][key] ?? 0) + 1
    return { applied: { ui_meta: true } }
  }

  // Soul and description are written before the model, as the engine does.
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
    if (typeof params.model === 'string' && typeof params.provider === 'string') {
      if (expensiveModels.has(params.model) && params.confirm_expensive_model !== true)
        return { ok: true, applied, confirm_required: true, confirm_message: 'Costs more' }
      apply(
        'model',
        () => (state.model = { provider: params.provider as string, model: params.model as string })
      )
    }
    return { ok: Object.values(applied).every(Boolean), applied }
  }

  function createProfile(params: Record<string, unknown>): unknown {
    const name = params.name as string
    if (name === 'reserved') throw new Error('Profile name is reserved')
    if (metadata[name]) throw new Error(`Profile '${name}' already exists`)
    created.push(structuredClone(params))
    metadata[name] = {}
    revisions[name] = {}
    profiles[name] = {
      description: '',
      soul: (params.soul as string) ?? '',
      model:
        typeof params.model === 'string'
          ? { provider: params.provider as string, model: params.model }
          : null
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
    if (method !== 'profiles.configure') throw new Error(`Unexpected method ${method}`)
    return params.ui_meta ? configureMeta(profile, params) : configureSections(params)
  }
  const double: EngineDouble = {
    request,
    rooms,
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
    failMetaOnce: () => {
      metaFailure = true
    }
  }
  return double
}

export function backendFor(
  engine: Pick<EngineDouble, 'request'> & Partial<EngineDouble>
): RosterBackend {
  return {
    request: engine.request,
    botMetaKey: BOT_META_KEY,
    botGroupsMetaKey: GROUPS_META_KEY,
    deleteProfile: async (profile) => {
      if (!engine.metadata || !engine.deleted) throw new Error('Not used')
      delete engine.metadata[profile]
      engine.deleted.push(profile)
    }
  }
}
