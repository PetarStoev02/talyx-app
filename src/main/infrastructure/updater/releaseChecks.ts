import type { UpdateCheck } from '../../../shared/updater'
import type { ReleaseCheck, FoundRelease } from './releaseCheck'

export interface ReleaseChecksDeps {
  fetchLatest: () => Promise<ReleaseCheck>
  /** The latest release newer than this Talyx, or null when it is up to date. */
  found: (release: FoundRelease | null) => void
  now: () => number
}

export interface ReleaseChecks {
  /** Checks GitHub now, or joins the check already running. */
  check: () => Promise<UpdateCheck>
  /** Checks only when the last check started more than `maxAgeMs` ago. */
  checkIfOlderThan: (maxAgeMs: number) => void
}

/** One release check at a time, whoever asks: the timer, a wake, a focus or the Settings button. */
export function createReleaseChecks(deps: ReleaseChecksDeps): ReleaseChecks {
  let running: Promise<UpdateCheck> | null = null
  let lastStarted = -Infinity

  async function run(): Promise<UpdateCheck> {
    const result = await deps.fetchLatest()
    // A failed check keeps what the update button shows.
    if (result.kind === 'failed') return result
    if (result.kind === 'up-to-date') {
      deps.found(null)
      return result
    }
    deps.found(result.release)
    return { kind: 'available', version: result.release.summary.version }
  }

  function check(): Promise<UpdateCheck> {
    if (running) return running
    lastStarted = deps.now()
    running = run().finally(() => (running = null))
    return running
  }

  return {
    check,
    checkIfOlderThan(maxAgeMs) {
      if (deps.now() - lastStarted > maxAgeMs) void check()
    }
  }
}
