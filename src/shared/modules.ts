// What main tells the page about modules. A module is signed code that adds a page to Talyx; it is
// installed into userData from inside the app and runs only while a valid license unlocks it.
// Must not import 'electron': it compiles in both the node and web tsconfigs.

/** The contract a module is built against. A module with another number is not loaded. */
export const MODULE_API_VERSION = 1

/** The scheme the page imports a module's files from (talyx-module://<id>/renderer.js). */
export const MODULE_SCHEME = 'talyx-module'

/** The deep link that opens the activation dialog: talyx://activate?key=TALYX-... */
export const ACTIVATION_LINK = { scheme: 'talyx', action: 'activate' } as const

export interface LicenseSummary {
  /** A random key id, never an email, so it can appear in logs. */
  id: string
  /** Who the key was made for, as shown in Settings. */
  name: string
  /** The module ids this key unlocks, or ALL_MODULES for every module. Ask `unlocksModule`. */
  modules: string[]
  /** ISO date the key stops working; null for no end. */
  expires: string | null
}

/** A license that names this module id unlocks every module, also ones made after the key. */
export const ALL_MODULES = 'all'

export function unlocksModule(license: Pick<LicenseSummary, 'modules'>, id: string): boolean {
  return license.modules.includes(id) || license.modules.includes(ALL_MODULES)
}

export type ModuleStatus = 'running' | 'failed' | 'incompatible'

export interface ModuleSummary {
  id: string
  name: string
  version: string
  status: ModuleStatus
  /** Why a module did not start; null while it runs. */
  problem: string | null
  /** Whether the module ships a stylesheet the page should link. */
  styled: boolean
}

/** No license means no module UI anywhere: someone who never bought anything sees nothing. */
export interface ModulesState {
  license: LicenseSummary | null
  /** Installed modules the license unlocks. */
  modules: ModuleSummary[]
}

/** A module the license unlocks, as the published catalog lists it. */
export interface AvailableModule {
  id: string
  name: string
  version: string
  /** False when this Talyx cannot run that version. */
  compatible: boolean
}

/** A pending request to open the activation dialog, from the menu (no key) or a link (a key). */
export interface ActivationRequest {
  key: string | null
}
