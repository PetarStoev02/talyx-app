import { expect } from 'vitest'
import type { RosterBackend, RosterRequest } from '../../../src/renderer/src/features/bots/data'
import type { Room } from '../../../src/renderer/src/features/bots/types'

export const BOT_META_KEY = 'acme-bots'
export const GROUPS_META_KEY = 'acme-bots-groups'

export interface EngineDouble {
  request: RosterRequest
  metadata: Record<string, Record<string, unknown>>
  configureCalls: string[]
  deleted: string[]
  conflictOnce: () => void
}

// In-memory engine: profiles.list, groups.list and a revision-checked profiles.configure.
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
  const configureCalls: string[] = []
  const deleted: string[] = []
  let conflict = false
  const request: RosterRequest = async (profile, method, params) => {
    if (method === 'profiles.list')
      return {
        profiles: Object.entries(metadata).map(([name, ui_meta]) => ({
          name,
          ui_meta: structuredClone(ui_meta),
          ui_meta_revisions: { ...revisions[name] }
        }))
      }
    if (method === 'groups.list') return { rooms: structuredClone(rooms), next_offset: null }
    if (method !== 'profiles.configure') throw new Error(`Unexpected method ${method}`)
    const patch = params.ui_meta as Record<string, unknown>
    const key = Object.keys(patch)[0]
    configureCalls.push(`${profile}:${key}`)
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
  return {
    request,
    metadata,
    configureCalls,
    deleted,
    conflictOnce: () => {
      conflict = true
    }
  }
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
