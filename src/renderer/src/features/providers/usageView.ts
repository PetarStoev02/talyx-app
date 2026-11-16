// The Usage page's state, shared by the page and its sidebar: the period, the picked provider and
// the report they both show.
import { create } from 'zustand'
import { loadProviders } from './providers'
import type { ProvidersBackend } from './providers'
import { loadUsage } from './usage'
import type { UsagePeriod, UsageReport } from './usage'

interface UsageViewState {
  days: UsagePeriod
  /** The picked provider's id; null shows all of them. */
  provider: string | null
  /** The last report and the period it covers; it stays while the next one loads. */
  shown: { report: UsageReport; days: UsagePeriod } | null
  /** A load is running; `shown` is then the previous one, or null at first. */
  loading: boolean
  problem: unknown
  setDays: (days: UsagePeriod) => void
  pick: (provider: string | null) => void
  /** Loads the report for the period; a newer load wins over an older one still running. */
  load: (backend: ProvidersBackend) => Promise<void>
}

let latest = 0

export const useUsageView = create<UsageViewState>((set, get) => ({
  days: 30,
  provider: null,
  shown: null,
  loading: false,
  problem: null,
  setDays: (days) => set({ days }),
  pick: (provider) => set({ provider }),
  load: async (backend) => {
    const request = ++latest
    const days = get().days
    set({ loading: true, problem: null })
    try {
      const overview = await loadProviders(backend)
      const report = await loadUsage(backend, { overview, days })
      if (request === latest) set({ shown: { report, days }, loading: false })
    } catch (problem) {
      if (request === latest) set({ problem, loading: false })
    }
  }
}))
