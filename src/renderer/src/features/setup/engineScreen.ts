import { engineVersionFit, type EngineStatus } from '../../../../shared/engine'
import type { InstallExit, InstallSteps } from '../../../../shared/setup'

/** Which engine screen of the setup shows (the spec's screens 2 to 6b). */
export type EngineScreen =
  | { kind: 'checking' }
  | { kind: 'attachError'; message: string }
  | { kind: 'fetching' }
  | { kind: 'commands'; steps: Extract<InstallSteps, { kind: 'ready' }> }
  | { kind: 'stepsFailed'; reason: 'unavailable' | 'mismatch'; releaseUrl: string }
  | { kind: 'unsupported'; releaseUrl: string }
  | { kind: 'running' }
  | { kind: 'stopped'; index: number; code: number }
  | { kind: 'notFound' }
  | { kind: 'ready'; version: string; newer: boolean; stale: boolean }
  /** `attached` false: it cannot attach either, so only the update is offered. */
  | { kind: 'older'; version: string; attached: boolean }

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
  if (exit?.kind === 'failed') return { kind: 'stopped', index: exit.index, code: exit.code }
  if (facts.checking || !status) return { kind: 'checking' }
  // A finished install is judged by the check that follows it, not by the steps.
  if (exit?.kind === 'ok') return foundScreen(status)
  if (facts.wantsInstall || status.state === 'missing') return installScreen(facts.steps)
  return foundScreen(status)
}

function foundScreen(status: EngineStatus): EngineScreen {
  if (status.state === 'missing') return { kind: 'notFound' }
  if (status.state === 'error') {
    // An old engine that cannot attach is offered the update, not the generic error.
    return status.version !== null && engineVersionFit(status.version) === 'older'
      ? { kind: 'older', version: status.version, attached: false }
      : { kind: 'attachError', message: status.message }
  }
  const fit = engineVersionFit(status.version)
  if (fit === 'older') return { kind: 'older', version: status.version, attached: true }
  return { kind: 'ready', version: status.version, newer: fit === 'newer', stale: status.stale }
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
