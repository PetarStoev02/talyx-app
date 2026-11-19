// The Usage page's state, shared by the page and its sidebar: the period, the picked provider and
// the report they both show. Loading it is `loadUsageView` (usageView.ts).
import { create } from 'zustand'
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
}

export const useUsageView = create<UsageViewState>((set) => ({
  days: 30,
  provider: null,
  shown: null,
  loading: false,
  problem: null,
  setDays: (days) => set({ days }),
  pick: (provider) => set({ provider })
}))
