import {
  unlocksModule,
  type AvailableModule,
  type ModuleStatus,
  type ModulesState
} from '../../../../shared/modules'

export interface ModuleRow {
  id: string
  name: string
  /** The installed version; null when it is not installed. */
  installed: string | null
  status: ModuleStatus | null
  problem: string | null
  /** What the row's button does; null when there is nothing to do (or this Talyx can't run it). */
  action: 'install' | 'update' | null
  /** The catalog's version, when it is one this Talyx can run and differs from the installed one. */
  offered: string | null
}

/**
 * One row per module the license unlocks: what is installed, merged with what the catalog offers
 * (null while the catalog is loading or could not be read, so installed modules still show).
 * The modules the key names come first, in its order. A key for every module names none of them,
 * so the installed and the offered ones follow by name: installing one must not move the rows,
 * or the pointer lands on another module's button.
 */
export function moduleRows(state: ModulesState, available: AvailableModule[] | null): ModuleRow[] {
  const license = state.license
  if (!license) return []
  // The catalog's name wins, so a bundle that names itself otherwise can't move its row on install.
  const names = new Map([...state.modules, ...(available ?? [])].map((m) => [m.id, m.name]))
  const listed = [...names.keys()].sort(
    (a, b) => names.get(a)!.localeCompare(names.get(b)!) || a.localeCompare(b)
  )
  // The catalog may have been read for an earlier key, so every id is checked against this one.
  const ids = [...new Set([...license.modules, ...listed])].filter((id) =>
    unlocksModule(license, id)
  )
  return ids.flatMap((id) => {
    const installed = state.modules.find((module) => module.id === id) ?? null
    const listed = available?.find((module) => module.id === id) ?? null
    if (!installed && !listed) return []
    const offered =
      listed?.compatible && listed.version !== installed?.version ? listed.version : null
    return {
      id,
      name: installed?.name ?? listed?.name ?? id,
      installed: installed?.version ?? null,
      status: installed?.status ?? null,
      problem: installed?.problem ?? null,
      action: offered ? (installed ? 'update' : 'install') : null,
      offered
    }
  })
}
