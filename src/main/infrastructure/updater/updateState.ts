import log from 'electron-log'
import type { ReleaseSummary, UpdateFailure, UpdateState } from '../../../shared/updater'
import type { FoundRelease } from './releaseCheck'

export type UpdateEvent =
  | { kind: 'found'; release: ReleaseSummary | null }
  | { kind: 'download'; total: number }
  | { kind: 'progress'; received: number; total: number }
  | { kind: 'verified' }
  | { kind: 'failed'; reason: UpdateFailure }
  | { kind: 'cancelled' }

export class ReleaseDownloadError extends Error {
  constructor(
    readonly reason: UpdateFailure,
    message: string
  ) {
    super(message)
    this.name = 'ReleaseDownloadError'
  }
}

const NONE: UpdateState = { kind: 'none' }

/** The state after `event`; the same object when the event changes nothing. */
export function next(state: UpdateState, event: UpdateEvent): UpdateState {
  switch (event.kind) {
    case 'found':
      // A running download is never swapped out; the next check sees the newer release.
      if (state.kind === 'downloading') return state
      // A downloaded self-update installs on quit whatever is offered; it stays until the restart,
      // and the release after it is offered then.
      if (state.kind === 'ready') return state
      if (!event.release) return state.kind === 'none' ? state : NONE
      if (state.kind !== 'none' && state.release.version === event.release.version) {
        // Assets or notes added after publishing reach an idle state; a finished download stays.
        const idle = state.kind === 'available' || state.kind === 'failed'
        return idle && !sameRelease(state.release, event.release)
          ? { kind: 'available', release: event.release }
          : state
      }
      return { kind: 'available', release: event.release }
    case 'download':
      if ((state.kind !== 'available' && state.kind !== 'failed') || !state.release.downloadable)
        return state
      return { kind: 'downloading', release: state.release, received: 0, total: event.total }
    case 'progress':
      if (state.kind !== 'downloading') return state
      return { ...state, received: event.received, total: event.total }
    case 'verified':
      return state.kind === 'downloading' ? { kind: 'ready', release: state.release } : state
    case 'failed':
      // A download fails while downloading; a verified one fails when the restart cannot start.
      if (state.kind !== 'downloading' && state.kind !== 'ready') return state
      return { kind: 'failed', release: state.release, reason: event.reason }
    case 'cancelled':
      return state.kind === 'downloading' ? { kind: 'available', release: state.release } : state
  }
}

function sameRelease(a: ReleaseSummary, b: ReleaseSummary): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Installs a verified download: restarts Talyx into the update. */
export type Install = () => Promise<void>

export interface UpdateStoreDeps {
  /** Downloads the offered version; `signal` cancels it. */
  download: (
    version: string,
    onProgress: (received: number, total: number) => void,
    signal: AbortSignal
  ) => Promise<Install>
  publish: (state: UpdateState) => void
}

export interface UpdateStore {
  current: () => UpdateState
  /** The latest release a check found, or null when Talyx is up to date. */
  found: (release: FoundRelease | null) => void
  startDownload: () => Promise<void>
  cancel: () => void
  install: () => Promise<void>
}

export function createUpdateStore(deps: UpdateStoreDeps): UpdateStore {
  let state: UpdateState = NONE
  // What `state` is about.
  let release: FoundRelease | null = null
  let installer: Install | null = null
  let running: AbortController | null = null

  const apply = (event: UpdateEvent): boolean => {
    const after = next(state, event)
    if (after === state) return false
    state = after
    deps.publish(state)
    return true
  }

  async function startDownload(): Promise<void> {
    const target = release
    if (!target || !apply({ kind: 'download', total: 0 })) return
    const controller = new AbortController()
    running = controller
    const name = `v${target.summary.version}`
    try {
      installer = await deps.download(
        target.summary.version,
        (received, total) => apply({ kind: 'progress', received, total }),
        controller.signal
      )
      apply({ kind: 'verified' })
    } catch (error) {
      if (controller.signal.aborted) {
        log.info(`[Updater] ${name} cancelled`)
        apply({ kind: 'cancelled' })
        return
      }
      const reason = error instanceof ReleaseDownloadError ? error.reason : 'other'
      log.warn(`[Updater] ${name} failed (${reason})`)
      apply({ kind: 'failed', reason })
    } finally {
      running = null
    }
  }

  return {
    current: () => state,

    found(found) {
      if (!apply({ kind: 'found', release: found?.summary ?? null })) return
      release = state.kind === 'none' ? null : found
      installer = null
    },

    startDownload,

    cancel() {
      running?.abort()
    },

    async install() {
      if (state.kind !== 'ready' || !installer)
        throw new ReleaseDownloadError('other', 'No verified download to install')
      try {
        await installer()
      } catch (error) {
        // The restart did not start: offer Try again instead of a dead button.
        log.warn('[Updater] The update could not be installed')
        installer = null
        apply({ kind: 'failed', reason: 'other' })
        throw error
      }
    }
  }
}
