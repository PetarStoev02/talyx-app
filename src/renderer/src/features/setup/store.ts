import { create } from 'zustand'
import type { EngineStatus } from '@contract/engine'
import type { InstallExit, InstallSteps } from '@contract/setup'
import { settingsApi } from '@shared/api/ipc'
import { host } from '@shared/engine/host'
import type { ConnectionState } from '@shared/engine/host'
import { reportError } from '@shared/lib/report'
import type { SetupBackend } from './install'
import { hasProvider, type ProviderPresence } from './steps'

// The output a screen keeps: the tail of a long install, enough to read or copy what went wrong.
const MAX_OUTPUT_CHARS = 200_000

interface SetupState {
  setupDone: boolean | null
  /** Run setup again: the flow shows from Welcome even when every step is already done. */
  forced: boolean
  hasProvider: boolean | null
  hasOwnBot: boolean | null
  load: () => Promise<void>
  finish: () => Promise<void>
  restart: () => Promise<void>
  setHasProvider: (value: boolean) => void
  setHasOwnBot: (value: boolean) => void
}

export const useSetup = create<SetupState>((set) => ({
  setupDone: null,
  forced: false,
  hasProvider: null,
  hasOwnBot: null,
  load: async () => set({ setupDone: (await settingsApi.get()).setupDone }),
  finish: async () => {
    await settingsApi.set({ setupDone: true })
    set({ setupDone: true, forced: false })
  },
  restart: async () => {
    await settingsApi.set({ setupDone: false })
    // Unknown until read again: a provider or bot may have come or gone since the last read.
    set({ setupDone: false, forced: true, hasProvider: null, hasOwnBot: null })
  },
  setHasProvider: (value) => set({ hasProvider: value }),
  setHasOwnBot: (value) => set({ hasOwnBot: value })
}))

/** What a providers form reports after each change: the setup step and the chat's nudge read it. */
export function reportProvider(overview: ProviderPresence): void {
  useSetup.getState().setHasProvider(hasProvider(overview))
}

interface InstallState {
  steps: InstallSteps | null
  output: string
  running: boolean
  exit: InstallExit | null
  loadSteps: (backend: SetupBackend) => Promise<void>
  start: (backend: SetupBackend) => Promise<void>
  cancel: (backend: SetupBackend) => Promise<void>
}

// The window lives as long as the store does, so the listeners are never unsubscribed.
const subscribed = new WeakSet<SetupBackend>()

export const useInstall = create<InstallState>((set) => {
  const subscribe = (backend: SetupBackend): void => {
    if (subscribed.has(backend)) return
    subscribed.add(backend)
    backend.onOutput((_index, text) =>
      set((state) => ({ output: (state.output + text).slice(-MAX_OUTPUT_CHARS) }))
    )
    backend.onExit((exit) => {
      // Before the exit lands, so the screen shows the check rather than "cannot find the engine".
      if (exit.kind === 'ok') void backend.recheckEngine()
      set({ running: false, exit })
    })
  }
  return {
    steps: null,
    output: '',
    running: false,
    exit: null,
    loadSteps: async (backend) => set({ steps: await backend.installSteps() }),
    start: async (backend) => {
      subscribe(backend)
      set({ output: '', exit: null, running: true })
      try {
        await backend.run()
      } catch (error) {
        set({ running: false })
        throw error
      }
    },
    cancel: (backend) => backend.cancel()
  }
})

interface EngineState {
  status: EngineStatus | null
  checking: boolean
  /** When the last check finished (ms since epoch), for "Checked just now"; null before the first. */
  checkedAt: number | null
  /** The gateway socket's state, and when it last changed (ms since epoch). */
  connection: ConnectionState
  connectionSince: number
  /** False until the socket has opened once: before that there is nothing to reconnect to. */
  everConnected: boolean
  /** When an open socket was lost (ms since epoch), until it opens again; null while open. */
  lostAt: number | null
  check: () => Promise<void>
  /** `check` without the checking state: the screen stays as it is until the answer differs. */
  refresh: () => Promise<void>
  pickPath: () => Promise<void>
  /** Run the engine the install linked in the user bin; rejects when nothing is installed there. */
  useInstalled: () => Promise<void>
}

/** Engine presence and attachment, as main reports it; the gateway socket opens once attached. */
export const useEngine = create<EngineState>((set) => {
  const apply = async (next: Promise<EngineStatus>): Promise<void> => {
    try {
      const status = await next
      set({ status })
      // A failed first dial keeps redialing on its own; the gate shows the wait, the log the cause.
      if (status.state === 'attached')
        host.connect().catch((error: unknown) => reportError('engine', error))
    } catch (err) {
      set({
        status: {
          state: 'error',
          message: err instanceof Error ? err.message : String(err),
          version: null,
          reason: null
        }
      })
    }
  }
  const settle = async (next: Promise<EngineStatus>): Promise<void> => {
    set({ checking: true })
    try {
      await apply(next)
    } finally {
      set({ checking: false, checkedAt: Date.now() })
    }
  }
  return {
    status: null,
    checking: false,
    checkedAt: null,
    connection: 'idle',
    connectionSince: Date.now(),
    everConnected: false,
    lostAt: null,
    check: () => settle(host.status()),
    refresh: () => apply(host.status()),
    pickPath: () => settle(host.pickEnginePath()),
    useInstalled: async () => {
      // A missing install is the caller's to say, not an engine status: the status stays as it was.
      set({ checking: true })
      const status = await host.useInstalledEngine().finally(() => set({ checking: false }))
      await settle(Promise.resolve(status))
    }
  }
})

// After the store exists: the gateway reports its current state as soon as one subscribes.
host.onState((connection) =>
  useEngine.setState((state) => ({
    connection,
    connectionSince: Date.now(),
    everConnected: state.everConnected || connection === 'open',
    // Redials cycle through connecting and error; the loss dates from the first of them.
    lostAt:
      connection === 'open' ? null : (state.lostAt ?? (state.everConnected ? Date.now() : null))
  }))
)
