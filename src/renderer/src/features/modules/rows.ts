import type { AvailableModule, ModuleStatus, ModulesState } from '../../../../shared/modules'

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
 */
export function moduleRows(state: ModulesState, available: AvailableModule[] | null): ModuleRow[] {
  return (state.license?.modules ?? []).flatMap((id) => {
    const installed = state.modules.find((module) => module.id === id) ?? null
    const listed = available?.find((module) => module.id === id) ?? null
    if (!installed && !listed) return []
    const offered =
      listed?.compatible && listed.version !== installed?.version ? listed.version : null
    return [
      {
        id,
        name: installed?.name ?? listed?.name ?? id,
        installed: installed?.version ?? null,
        status: installed?.status ?? null,
        problem: installed?.problem ?? null,
        action: offered ? (installed ? 'update' : 'install') : null,
        offered
      }
    ]
  })
}
