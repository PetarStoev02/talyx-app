import { create } from 'zustand'
import type { OfficeSnapshot } from '../../../../shared/office'

interface OfficeState {
  snapshot: OfficeSnapshot | null
  selectedBotId: string | null
  load: (projectId: string | null) => Promise<void>
  select: (id: string | null) => void
  subscribe: () => () => void
}

export const useOffice = create<OfficeState>((set, get) => ({
  snapshot: null,
  selectedBotId: null,
  load: async (projectId) => {
    // null lets main pick the current project
    set({ snapshot: await window.api.officeSnapshot(projectId) })
  },
  select: (id) => set({ selectedBotId: id }),
  // Main pushes the current project; ignore pushes for a project we are not showing.
  subscribe: () =>
    window.api.onOfficeChanged((snapshot) => {
      const shown = get().snapshot
      if (!shown || shown.project.id === snapshot.project.id) set({ snapshot })
    })
}))
