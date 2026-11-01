import { create } from 'zustand'
import type { ConversationTarget, OfficeSnapshot } from '../../../../shared/office'

interface OfficeState {
  snapshot: OfficeSnapshot | null
  selection: ConversationTarget | null
  load: (projectId: string | null) => Promise<void>
  select: (target: ConversationTarget | null) => void
  subscribe: () => () => void
}

export const useOffice = create<OfficeState>((set, get) => ({
  snapshot: null,
  selection: null,
  load: async (projectId) => {
    // null lets main pick the current project
    set({ snapshot: await window.api.officeSnapshot(projectId) })
  },
  select: (target) => set({ selection: target }),
  // Main pushes the current project; ignore pushes for a project we are not showing.
  subscribe: () =>
    window.api.onOfficeChanged((snapshot) => {
      const shown = get().snapshot
      if (!shown || shown.project.id === snapshot.project.id) set({ snapshot })
    })
}))
