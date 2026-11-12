import { create } from 'zustand'
import { modulesApi } from '@shared/api/ipc'
import type { ModuleSummary, ModulesState } from '../../../../shared/modules'

interface ModulesStore {
  /** As main reports it; no license means no module UI anywhere. */
  state: ModulesState
  /** Reads the current state and follows main's announcements from then on. */
  load: () => Promise<void>
}

let subscribed = false

export const useModules = create<ModulesStore>((set) => ({
  state: { license: null, modules: [] },
  load: async () => {
    if (!subscribed) {
      subscribed = true
      modulesApi.onState((state) => set({ state }))
    }
    set({ state: await modulesApi.state() })
  }
}))

interface ModuleAttentionStore {
  /** By module id: how many things wait on you, as the module's Background last said. */
  needsYou: Record<string, number>
  setNeedsYou: (id: string, count: number) => void
}

export const useModuleAttention = create<ModuleAttentionStore>((set) => ({
  needsYou: {},
  setNeedsYou: (id, count) =>
    set((s) => (s.needsYou[id] === count ? s : { needsYou: { ...s.needsYou, [id]: count } }))
}))

/** The modules whose page can open: a failed or incompatible one has no tab. */
export function runningModules(state: ModulesState): ModuleSummary[] {
  return state.modules.filter((module) => module.status === 'running')
}

/** The navigation view of a module's page. */
export type ModuleView = `module:${string}`

export function moduleView(id: string): ModuleView {
  return `module:${id}`
}

export function moduleIdOf(view: string): string | null {
  return view.startsWith('module:') ? view.slice('module:'.length) : null
}
