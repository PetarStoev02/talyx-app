import { create } from 'zustand'
import type { InstallExit, InstallSteps } from '../../../../shared/setup'

export interface SetupBackend {
  installSteps: () => Promise<InstallSteps>
  run: () => Promise<void>
  cancel: () => Promise<void>
  onOutput: (cb: (index: number, text: string) => void) => () => void
  onExit: (cb: (exit: InstallExit) => void) => () => void
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
    backend.onOutput((_index, text) => set((state) => ({ output: state.output + text })))
    backend.onExit((exit) => set({ running: false, exit }))
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
