import { create } from 'zustand'
import type { OfficeSnapshot } from '../../../../shared/office'

// Main seeds this project on every start; used when no project has been chosen yet.
const SEED_PROJECT_ID = 'agro-ops'

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
    const id = projectId ?? (await currentProjectId())
    set({ snapshot: await window.api.officeSnapshot(id) })
  },
  select: (id) => set({ selectedBotId: id }),
  // Main pushes the current project; ignore pushes for a project we are not showing.
  subscribe: () =>
    window.api.onOfficeChanged((snapshot) => {
      const shown = get().snapshot
      if (!shown || shown.project.id === snapshot.project.id) set({ snapshot })
    })
}))

async function currentProjectId(): Promise<string> {
  const settings = (await window.api.getSettings()) as { currentProjectId?: unknown }
  return typeof settings.currentProjectId === 'string' ? settings.currentProjectId : SEED_PROJECT_ID
}
