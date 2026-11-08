import { create } from 'zustand'
import type { EngineStatus } from '../../../../shared/engine'
import { host } from '@shared/engine/host'
import type { ConnectionState } from '@shared/engine/host'
import { reportError } from '@shared/lib/report'

interface EngineState {
  status: EngineStatus | null
  checking: boolean
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
      set({ checking: false })
    }
  }
  return {
    status: null,
    checking: false,
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
