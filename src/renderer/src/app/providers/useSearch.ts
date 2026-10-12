import { create } from 'zustand'
import type { SearchResult, SearchStats } from '@shared/api/ipc'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  results?: SearchResult[]
  timestamp: number
}

export type ScanStatus = 'none' | 'scanning' | 'paused' | 'complete'

interface SearchState {
  // Scan state
  scanStatus: ScanStatus
  scanProgress: number
  scanTotal: number
  scanCurrent: string
  scanCancelled: boolean
  scanPaused: boolean

  // Chat state
  messages: ChatMessage[]
  loading: boolean
  stats: SearchStats | null

  // Scan actions
  setScanStatus: (status: ScanStatus) => void
  setScanProgress: (current: number, total: number, fileName: string) => void
  pauseScan: () => void
  resumeScan: () => void
  cancelScan: () => void

  // Chat actions
  addMessage: (message: ChatMessage) => void
  setLoading: (loading: boolean) => void
  setStats: (stats: SearchStats) => void
  updateLastAssistant: (update: Partial<ChatMessage>) => void
  reset: () => void
}

export const useSearch = create<SearchState>((set) => ({
  scanStatus: 'none',
  scanProgress: 0,
  scanTotal: 0,
  scanCurrent: '',
  scanCancelled: false,
  scanPaused: false,

  messages: [],
  loading: false,
  stats: null,

  setScanStatus: (status) => set({ scanStatus: status }),
  setScanProgress: (current, total, fileName) =>
    set({ scanProgress: current, scanTotal: total, scanCurrent: fileName }),
  pauseScan: () => set({ scanPaused: true, scanStatus: 'paused' }),
  resumeScan: () => set({ scanPaused: false, scanStatus: 'scanning' }),
  cancelScan: () =>
    set((s) => ({
      scanCancelled: true,
      scanStatus: (s.stats?.indexedFiles ?? 0) > 0 ? 'complete' : 'none',
      scanProgress: 0,
      scanTotal: 0,
      scanCurrent: ''
    })),

  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  setLoading: (loading) => set({ loading }),
  setStats: (stats) => set({ stats }),
  updateLastAssistant: (update) =>
    set((s) => {
      const msgs = [...s.messages]
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'assistant') {
          msgs[i] = { ...msgs[i], ...update }
          break
        }
      }
      return { messages: msgs }
    }),
  reset: () => set({ messages: [], loading: false })
}))
