import { EXPECTED_ENGINE_VERSION, isEngineCurrent, type EngineStatus } from '@contract/engine'
import type { UpdateState } from '@contract/updater'
import { DAY_MS, HOUR_MS, MINUTE_MS } from '@shared/lib/time'

/** One pending update the footer button offers. */
export type UpdateItem =
  | { kind: 'engine'; installed: string; pinned: string }
  | { kind: 'talyx'; state: Exclude<UpdateState, { kind: 'none' }> }
  | { kind: 'module'; id: string; name: string; installed: string; offered: string }

/** A module as the Modules page lists it (its `ModuleRow`): what is installed, what is offered. */
export interface ModuleVersions {
  id: string
  name: string
  installed: string | null
  offered: string | null
}

/**
 * What the footer button offers, engine first: an older engine can break the running app now, a
 * newer Talyx or module cannot. Only installed modules: one not installed is not an update.
 * Empty when nothing is pending (the roster's refresh shows instead).
 */
export function updateItems(
  engine: EngineStatus | null,
  update: UpdateState,
  modules: ModuleVersions[]
): UpdateItem[] {
  const items: UpdateItem[] = []
  if (engine?.state === 'attached' && !isEngineCurrent(engine))
    items.push({ kind: 'engine', installed: engine.version, pinned: EXPECTED_ENGINE_VERSION })
  if (update.kind !== 'none') items.push({ kind: 'talyx', state: update })
  for (const { id, name, installed, offered } of modules)
    if (installed !== null && offered !== null)
      items.push({ kind: 'module', id, name, installed, offered })
  return items
}

export interface ReleaseAge {
  unit: 'now' | 'minutes' | 'hours' | 'days'
  count: number
}

/** How long ago a release came out ("3h ago"), whole units rounded down; null for a bad date. */
export function releaseAge(publishedAt: string, now: number): ReleaseAge | null {
  const published = Date.parse(publishedAt)
  if (Number.isNaN(published)) return null
  const elapsed = now - published
  if (elapsed >= DAY_MS) return { unit: 'days', count: Math.floor(elapsed / DAY_MS) }
  if (elapsed >= HOUR_MS) return { unit: 'hours', count: Math.floor(elapsed / HOUR_MS) }
  if (elapsed >= MINUTE_MS) return { unit: 'minutes', count: Math.floor(elapsed / MINUTE_MS) }
  return { unit: 'now', count: 0 }
}
