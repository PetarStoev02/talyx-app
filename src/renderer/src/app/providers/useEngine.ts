import { create } from 'zustand'
import type { EngineStatus } from '../../../../shared/engine'
import { host } from '@shared/engine/host'

interface EngineState {
  status: EngineStatus | null
  checking: boolean
  check: () => Promise<void>
  pickPath: () => Promise<void>
}

/** Engine presence and attachment, as main reports it; the gateway socket opens once attached. */
export const useEngine = create<EngineState>((set) => {
  const settle = async (next: Promise<EngineStatus>): Promise<void> => {
    set({ checking: true })
    try {
      const status = await next
      set({ status })
      if (status.state === 'attached') void host.connect().catch(() => undefined)
    } catch (err) {
      set({ status: { state: 'error', message: err instanceof Error ? err.message : String(err) } })
    } finally {
      set({ checking: false })
    }
  }
  return {
    status: null,
    checking: false,
    check: () => settle(host.status()),
    pickPath: () => settle(host.pickEnginePath())
  }
})
