import { engineVersionFit, type EngineStatus } from '../../../../shared/engine'

export interface EngineSummary {
  state: 'checking' | 'attached' | 'missing' | 'error' | 'protocol'
  message: string | null
  version: string | null
  path: string | null
  /** The found engine is newer than the one Talyx is tested with. */
  newer: boolean
  stale: boolean
  /** The install the user can start from here, when the engine is missing or not current. */
  action: 'install' | 'update' | null
}

const CHECKING: EngineSummary = {
  state: 'checking',
  message: null,
  version: null,
  path: null,
  newer: false,
  stale: false,
  action: null
}

/** What Settings shows of the engine, from the status main reports (null until the first check). */
export function engineSummary(status: EngineStatus | null): EngineSummary {
  if (!status) return CHECKING
  if (status.state === 'missing') return { ...CHECKING, state: 'missing', action: 'install' }
  const fit = engineVersionFit(status.version)
  const older = fit === 'older'
  const newer = fit === 'newer'
  if (status.state === 'error') {
    const protocol = status.reason === 'protocol'
    return {
      ...CHECKING,
      state: protocol ? 'protocol' : 'error',
      message: status.message,
      version: status.version,
      newer,
      // A protocol mismatch with a current engine needs another Talyx, not another engine.
      action: older ? 'update' : protocol ? null : 'install'
    }
  }
  return {
    ...CHECKING,
    state: 'attached',
    version: status.version,
    path: status.path,
    newer,
    stale: status.stale,
    action: older ? 'update' : null
  }
}
