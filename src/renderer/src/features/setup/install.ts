import { create } from 'zustand'
import type { InstallExit, InstallSteps } from '../../../../shared/setup'

export interface SetupBackend {
  installSteps: () => Promise<InstallSteps>
  run: () => Promise<void>
  cancel: () => Promise<void>
  onOutput: (cb: (index: number, text: string) => void) => () => void
  onExit: (cb: (exit: InstallExit) => void) => () => void
  /** Looks for the engine again; runs after every install that ends ok, whatever screen shows. */
  recheckEngine: () => Promise<void>
}

// The output a screen keeps: the tail of a long install, enough to read or copy what went wrong.
const MAX_OUTPUT_CHARS = 200_000
// eslint-disable-next-line no-control-regex -- matching terminal escapes is the point
const ANSI_CSI = /\x1b\[[0-9;?]*[A-Za-z]/g

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

/**
 * The output as a terminal would show it: colour codes dropped, and a line redrawn with `\r` (a
 * progress bar) showing only its last state. Copy output keeps the raw text.
 */
export function displayOutput(raw: string): string {
  return raw
    .replace(ANSI_CSI, '')
    .split('\n')
    .map((line) => {
      // A trailing \r (as in \r\n) erases nothing.
      const drawn = line.replace(/\r+$/, '')
      return drawn.slice(drawn.lastIndexOf('\r') + 1)
    })
    .join('\n')
}
