import { toast } from 'sonner'
import type { ReleaseSummary, UpdateState } from '../../../src/shared/updater'

const MODES = ['talyx', 'downloading', 'ready', 'failed', 'nodownload', 'engine', 'both'] as const
export type UpdateMode = (typeof MODES)[number]

const TICK_MS = 200
const TOTAL_BYTES = 100_000_000
const STEP_BYTES = 10_000_000
const HOUR_MS = 3_600_000
const RELEASE_URL = 'https://example.com/releases/v1.0.1-fixture'

/** The `?update=` mode in a page URL; null keeps the plain fixture. */
export function updateMode(search: string): UpdateMode | null {
  const mode = new URLSearchParams(search).get('update')
  return MODES.find((known) => known === mode) ?? null
}

/** `engine` and `both` attach an engine below the pin, so the footer offers its update. */
export function updateNeedsOlderEngine(mode: UpdateMode | null): boolean {
  return mode === 'engine' || mode === 'both'
}

function release(downloadable: boolean): ReleaseSummary {
  return {
    version: '1.0.1',
    url: RELEASE_URL,
    publishedAt: new Date(Date.now() - 3 * HOUR_MS).toISOString(),
    highlights: [
      { lead: 'One update button.', text: 'Talyx and engine updates share the footer.' },
      { lead: 'Downloads in the app.', text: 'The update is checked before it installs.' }
    ],
    changes: 9,
    downloadable
  }
}

function startState(mode: UpdateMode | null): UpdateState {
  const found = release(mode !== 'nodownload')
  if (mode === 'downloading')
    return { kind: 'downloading', release: found, received: 0, total: TOTAL_BYTES }
  if (mode === 'ready') return { kind: 'ready', release: found }
  if (mode === 'failed') return { kind: 'failed', release: found, reason: 'checksum' }
  if (mode === 'engine' || mode === null) return { kind: 'none' }
  return { kind: 'available', release: found }
}

/**
 * What main answers on the `updater:*` channels, for `window.api`: a download advances every
 * 200 ms to ready (`failed` ends in a checksum failure instead). Restarting into the update or
 * opening the release page only shows a toast.
 */
export function fixtureUpdates(mode: UpdateMode | null): Record<string, unknown> {
  let state = startState(mode)
  let timer: ReturnType<typeof setInterval> | null = null
  const listeners = new Set<(state: UpdateState) => void>()
  const publish = (next: UpdateState): void => {
    state = next
    for (const listener of listeners) listener(state)
  }
  const stop = (): void => {
    if (timer) clearInterval(timer)
    timer = null
  }
  const tick = (): void => {
    if (state.kind !== 'downloading') return stop()
    const received = state.received + STEP_BYTES
    if (received < state.total) return publish({ ...state, received })
    stop()
    publish(
      mode === 'failed'
        ? { kind: 'failed', release: state.release, reason: 'checksum' }
        : { kind: 'ready', release: state.release }
    )
  }
  const run = (): void => {
    stop()
    timer = setInterval(tick, TICK_MS)
  }
  if (state.kind === 'downloading') run()

  // The release page link: no real browser window, but only when an update mode is scripted.
  if (mode)
    window.open = (url) => {
      toast(`Would open ${String(url)}`)
      return null
    }

  return {
    // `reportError` calls it; the fixture has no log to write.
    logError: async () => undefined,
    getUpdateState: async () => state,
    downloadUpdate: async () => {
      if (state.kind !== 'available' && state.kind !== 'failed') return
      publish({ kind: 'downloading', release: state.release, received: 0, total: TOTAL_BYTES })
      run()
    },
    cancelUpdate: async () => {
      if (state.kind !== 'downloading') return
      stop()
      publish({ kind: 'available', release: state.release })
    },
    installUpdate: async () => {
      toast('Would restart into the update')
    },
    onUpdateState: (callback: (state: UpdateState) => void) => {
      listeners.add(callback)
      return () => {
        listeners.delete(callback)
      }
    }
  }
}
