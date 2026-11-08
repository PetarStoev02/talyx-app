import { engineVersionFit, isEngineCurrent, type EngineStatus } from '../../../../shared/engine'
import type { InstallExit, InstallSteps } from '../../../../shared/setup'

/** Which engine screen of the setup shows (the spec's screens 2 to 6b). */
export type EngineScreen =
  | { kind: 'checking' }
  | { kind: 'attachError'; message: string }
  | { kind: 'fetching' }
  | { kind: 'commands'; steps: Extract<InstallSteps, { kind: 'ready' }> }
  | { kind: 'stepsFailed'; reason: 'unavailable' | 'mismatch'; releaseUrl: string }
  | { kind: 'unsupported'; releaseUrl: string }
  /** The gateway speaks another protocol; an older engine gets the `older` update offer instead. */
  | { kind: 'protocol'; fit: 'newer' | 'same' }
  | { kind: 'running' }
  | { kind: 'stopped'; index: number; code: number }
  | { kind: 'notFound' }
  | { kind: 'ready'; version: string; path: string; newer: boolean; stale: boolean }
  /** `attached` false: it cannot attach either, so only the update is offered. */
  | { kind: 'older'; version: string; attached: boolean }
  /** An install finished, yet the engine Talyx runs (another copy, at `path`) is still older. */
  | { kind: 'still-older'; path: string; version: string }

export interface EngineScreenFacts {
  status: EngineStatus | null
  checking: boolean
  /** The user asked for the install steps (Install the engine, Update, the link on an error). */
  wantsInstall: boolean
  steps: InstallSteps | null
  running: boolean
  exit: InstallExit | null
}

export function engineScreen(facts: EngineScreenFacts): EngineScreen {
  const { status, exit } = facts
  if (facts.running) return { kind: 'running' }
  // A current engine found since (installed from a terminal, say) wins over the old failure.
  if (exit?.kind === 'failed' && !(status && isEngineCurrent(status)))
    return { kind: 'stopped', index: exit.index, code: exit.code }
  if (facts.checking || !status) return { kind: 'checking' }
  // A finished install is judged by the check that follows it, not by the steps; so is a failed
  // one once a current engine turned up (only that gets past the failure above).
  if (exit?.kind === 'ok' || exit?.kind === 'failed') return installedScreen(status)
  if (facts.wantsInstall || status.state === 'missing') return installScreen(facts.steps)
  return foundScreen(status)
}

function installedScreen(status: EngineStatus): EngineScreen {
  if (status.state === 'attached' && engineVersionFit(status.version) === 'older')
    return { kind: 'still-older', path: status.path, version: status.version }
  return foundScreen(status)
}

function foundScreen(status: EngineStatus): EngineScreen {
  if (status.state === 'missing') return { kind: 'notFound' }
  if (status.state === 'error') {
    // An old engine that cannot attach is offered the update, not the generic error.
    const fit = engineVersionFit(status.version)
    if (status.version !== null && fit === 'older')
      return { kind: 'older', version: status.version, attached: false }
    if (status.reason === 'protocol')
      return { kind: 'protocol', fit: fit === 'newer' ? 'newer' : 'same' }
    return { kind: 'attachError', message: status.message }
  }
  const fit = engineVersionFit(status.version)
  if (fit === 'older') return { kind: 'older', version: status.version, attached: true }
  return {
    kind: 'ready',
    version: status.version,
    path: status.path,
    newer: fit === 'newer',
    stale: status.stale
  }
}

/**
 * Follows the install runs a screen sees: `cancelled` once, when a run it saw ends in a cancel. A
 * cancel left in the store from an earlier visit does not count: that screen never saw it run.
 */
export function watchRun(
  sawRun: boolean,
  running: boolean,
  exit: InstallExit | null
): { sawRun: boolean; cancelled: boolean } {
  if (running) return { sawRun: true, cancelled: false }
  return { sawRun: false, cancelled: sawRun && exit?.kind === 'cancelled' }
}

/** The command that restarts the gateway of the engine at `path`, single-quoted for a POSIX shell. */
export function restartCommand(path: string): string {
  return `'${path.replaceAll("'", "'\\''")}' gateway restart`
}

function installScreen(steps: InstallSteps | null): EngineScreen {
  if (!steps) return { kind: 'fetching' }
  switch (steps.kind) {
    case 'ready':
      return { kind: 'commands', steps }
    case 'mismatch':
      return { kind: 'stepsFailed', reason: 'mismatch', releaseUrl: steps.releaseUrl }
    case 'unsupported':
      return { kind: 'unsupported', releaseUrl: steps.releaseUrl }
    default:
      return { kind: 'stepsFailed', reason: 'unavailable', releaseUrl: steps.releaseUrl }
  }
}
