import { create } from 'zustand'
import { toast } from 'sonner'
import { modulesApi } from '@shared/api/ipc'
import { useLanguage } from '@shared/lib/i18n'
import { problemOf } from '@shared/lib/problem'
import { reportError } from '@shared/lib/report'
import type { AvailableModule, ModuleSummary, ModulesState } from '@contract/modules'
import { mayLeave } from './leaveGuard'

interface ModulesStore {
  /** As main reports it; no license means no module UI anywhere. */
  state: ModulesState
  /** What the catalog offers this license; null until a read succeeds. */
  catalog: AvailableModule[] | null
  /** The last read failed; the catalog before it, if any, stays. */
  catalogFailed: boolean
  /** Reads the current state and follows main's announcements from then on. */
  load: () => Promise<void>
  /**
   * Reads the catalog, unless the last read started less than `maxAgeMs` ago. It is the only
   * network call modules make (it sends the license key), so without a license there is none.
   */
  readCatalog: (maxAgeMs: number) => Promise<void>
  /**
   * The module an install, update or uninstall runs for; null when none. Shared by the update
   * button and the Modules page, so closing one and clicking again elsewhere cannot start a second.
   */
  changing: string | null
  /** Installs `id`, or updates it to the catalog's version. A failure is logged and toasted. */
  install: (id: string) => Promise<void>
  uninstall: (id: string) => Promise<void>
}

let subscribed = false
let catalogReadAt = Number.NEGATIVE_INFINITY
// Counts the reads, so one that finishes after a newer one does not overwrite its answer.
let catalogReads = 0

export const useModules = create<ModulesStore>((set, get) => ({
  state: { license: null, modules: [] },
  catalog: null,
  catalogFailed: false,
  changing: null,
  load: async () => {
    if (!subscribed) {
      subscribed = true
      modulesApi.onState((state) => set({ state }))
    }
    set({ state: await modulesApi.state() })
  },
  readCatalog: async (maxAgeMs) => {
    if (!get().state.license || Date.now() - catalogReadAt < maxAgeMs) return
    catalogReadAt = Date.now()
    const read = ++catalogReads
    set({ catalogFailed: false })
    try {
      const catalog = await modulesApi.available()
      if (read === catalogReads) set({ catalog })
    } catch (error) {
      reportError('modules', error)
      if (read === catalogReads) set({ catalogFailed: true })
    }
  },
  install: (id) => change(id, modulesApi.install),
  uninstall: (id) => change(id, modulesApi.uninstall)
}))

// One change at a time; main announces the new state, so the result is not needed here.
async function change(id: string, run: (id: string) => Promise<unknown>): Promise<void> {
  if (useModules.getState().changing !== null) return
  useModules.setState({ changing: id })
  try {
    await run(id)
  } catch (error) {
    reportError('modules', error)
    toast.error(useLanguage.getState().t('modules.errorChange'), {
      description: problemOf(error).detail ?? undefined
    })
  } finally {
    useModules.setState({ changing: null })
  }
}

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

export type ModuleView = `module:${string}`

export function moduleView(id: string): ModuleView {
  return `module:${id}`
}

export function moduleIdOf(view: string): string | null {
  return view.startsWith('module:') ? view.slice('module:'.length) : null
}

/** Pages opened over the others from the footer; closing one goes back to where it was opened. */
const FOOTER_VIEWS = ['settings', 'usage'] as const
export type FooterView = (typeof FOOTER_VIEWS)[number]
export type AppView = 'agents' | FooterView | ModuleView

function isFooterView(view: AppView): view is FooterView {
  return (FOOTER_VIEWS as readonly AppView[]).includes(view)
}

interface NavigationState {
  currentView: AppView
  // The page Settings or Usage was opened from, where closing it goes back to.
  returnTo: AppView
  /**
   * Goes to `view`; leaving a module page first asks the page, which may keep the user there.
   * Resolves true once the view moved, false when the user stayed.
   */
  navigate: (view: AppView) => Promise<boolean>
  /** Leaves Settings or Usage for the page it was opened from (the agents keep their open chat). */
  goBack: () => Promise<boolean>
  /** Opens Settings or Usage, or closes it when it is open: the footer buttons and ⌘,. */
  toggle: (view: FooterView) => Promise<boolean>
}

export const useNavigation = create<NavigationState>((set, get) => ({
  currentView: 'agents',
  returnTo: 'agents',
  navigate: async (view) => {
    const from = get().currentView
    const move = (): void =>
      set(
        isFooterView(view) && !isFooterView(from)
          ? { currentView: view, returnTo: from }
          : { currentView: view }
      )
    if (view === from || !moduleIdOf(from)) {
      move()
      return true
    }
    const allowed = await mayLeave()
    // The user may have gone elsewhere while the page asked; only the view it asked about moves.
    if (!allowed || get().currentView !== from) return false
    move()
    return true
  },
  goBack: async () => {
    const { currentView, returnTo, navigate } = get()
    return isFooterView(currentView) ? navigate(returnTo) : false
  },
  toggle: async (view) => {
    const { currentView, goBack, navigate } = get()
    return currentView === view ? goBack() : navigate(view)
  }
}))
