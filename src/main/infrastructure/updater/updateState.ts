import log from 'electron-log'
import type { ReleaseSummary, UpdateFailure, UpdateState } from '../../../shared/updater'
import type { FoundRelease } from './releaseCheck'
import { ReleaseDownloadError } from './releaseDownload'

export type UpdateEvent =
  | { kind: 'found'; release: ReleaseSummary | null }
  | { kind: 'download'; total: number }
  | { kind: 'progress'; received: number; total: number }
  | { kind: 'verified' }
  | { kind: 'failed'; reason: UpdateFailure }
  | { kind: 'cancelled' }

const NONE: UpdateState = { kind: 'none' }

/** The state after `event`; the same object when the event changes nothing. */
export function next(state: UpdateState, event: UpdateEvent): UpdateState {
  switch (event.kind) {
    case 'found':
      // A running download is never swapped out; the next check sees the newer release.
      if (state.kind === 'downloading') return state
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
      // A download fails while downloading; a verified installer fails when it cannot be opened.
      if (state.kind !== 'downloading' && state.kind !== 'ready') return state
      return { kind: 'failed', release: state.release, reason: event.reason }
    case 'cancelled':
      return state.kind === 'downloading' ? { kind: 'available', release: state.release } : state
  }
}

function sameRelease(a: ReleaseSummary, b: ReleaseSummary): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export interface UpdateStoreDeps {
  download: (
    found: FoundRelease,
    onProgress: (received: number, total: number) => void,
    signal: AbortSignal
  ) => Promise<string>
  open: (file: string) => Promise<void>
  publish: (state: UpdateState) => void
}

export interface UpdateStore {
  current: () => UpdateState
  /** The latest release a check found, or null when Talyx is up to date. */
  found: (release: FoundRelease | null) => void
  startDownload: () => Promise<void>
  cancel: () => void
  openInstaller: () => Promise<void>
}

export function createUpdateStore(deps: UpdateStoreDeps): UpdateStore {
  let state: UpdateState = NONE
  // What `state` is about, kept in main: the asset URLs never reach the renderer.
  let release: FoundRelease | null = null
  let file: string | null = null
  let running: AbortController | null = null

  const apply = (event: UpdateEvent): boolean => {
    const after = next(state, event)
    if (after === state) return false
    state = after
    deps.publish(state)
    return true
  }

  return {
    current: () => state,

    found(found) {
      if (!apply({ kind: 'found', release: found?.summary ?? null })) return
      release = state.kind === 'none' ? null : found
      file = null
    },

    async startDownload() {
      const target = release
      if (!target || !apply({ kind: 'download', total: target.asset?.size ?? 0 })) return
      const controller = new AbortController()
      running = controller
      try {
        file = await deps.download(
          target,
          (received, total) => apply({ kind: 'progress', received, total }),
          controller.signal
        )
        apply({ kind: 'verified' })
      } catch (error) {
        if (controller.signal.aborted) {
          log.info(`[Updater] ${target.asset?.name} cancelled`)
          apply({ kind: 'cancelled' })
          return
        }
        const reason = error instanceof ReleaseDownloadError ? error.reason : 'other'
        log.warn(`[Updater] ${target.asset?.name} failed (${reason})`)
        apply({ kind: 'failed', reason })
      } finally {
        running = null
      }
    },

    cancel() {
      running?.abort()
    },

    async openInstaller() {
      if (state.kind !== 'ready' || !file)
        throw new ReleaseDownloadError('other', 'No verified download to open')
      try {
        await deps.open(file)
      } catch (error) {
        // The file is gone or cannot be opened: offer Try again instead of a dead button.
        log.warn('[Updater] The installer could not be opened')
        file = null
        apply({ kind: 'failed', reason: 'other' })
        throw error
      }
    }
  }
}
