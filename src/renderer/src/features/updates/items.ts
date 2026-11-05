import {
  EXPECTED_ENGINE_VERSION,
  isEngineCurrent,
  type EngineStatus
} from '../../../../shared/engine'
import type { UpdateState } from '../../../../shared/updater'

/** One pending update the footer button offers. */
export type UpdateItem =
  | { kind: 'engine'; installed: string; pinned: string }
  | { kind: 'talyx'; state: Exclude<UpdateState, { kind: 'none' }> }

/**
 * What the footer button offers, engine first: an older engine can break the running app now, a
 * newer Talyx cannot. Empty when nothing is pending (the roster's refresh shows instead).
 */
export function updateItems(engine: EngineStatus | null, update: UpdateState): UpdateItem[] {
  const items: UpdateItem[] = []
  if (engine?.state === 'attached' && !isEngineCurrent(engine))
    items.push({ kind: 'engine', installed: engine.version, pinned: EXPECTED_ENGINE_VERSION })
  if (update.kind !== 'none') items.push({ kind: 'talyx', state: update })
  return items
}

export interface ReleaseAge {
  unit: 'now' | 'minutes' | 'hours' | 'days'
  count: number
}

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

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
