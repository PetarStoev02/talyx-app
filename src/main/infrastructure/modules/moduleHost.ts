import { join } from 'node:path'
import { compileFunction } from 'node:vm'
import {
  MODULE_API_VERSION,
  MODULE_SCHEME,
  type AvailableModule,
  type LicenseSummary,
  type ModuleStatus,
  type ModulesState,
  unlocksModule
} from '../../../shared/modules'
import { ModuleActionSchema } from '../ipc/validation'
import { fetchBundleBytes, fetchCatalog } from './catalog'
import {
  installedIds,
  readInstalled,
  remove,
  stage,
  swapIn,
  type InstalledFiles
} from './moduleFiles'
import {
  expiryTime,
  isExpired,
  ModuleIdSchema,
  readBundle,
  readLicense,
  type ModuleBundle,
  type SigningKeys
} from './signing'

const CONTENT_TYPES: Record<string, string> = {
  'renderer.js': 'text/javascript',
  'style.css': 'text/css'
}
/** A module's activate or deactivate past this counts as failed, so one module never stalls the rest. */
const LIFECYCLE_TIMEOUT_MS = 10_000
/** setTimeout's ceiling (about 24.8 days); a later expiry is looked at again then. */
const MAX_TIMER_MS = 2 ** 31 - 1
/** In userData: one folder per installed module. */
const MODULES_FOLDER = 'modules'

export class ModuleError extends Error {
  override name = 'ModuleError'
}

class ModuleTimeoutError extends ModuleError {
  override name = 'ModuleTimeoutError'
}

type Handler = (input: unknown) => unknown

/** What a module's main.js gets from Talyx: the whole contract on the main side. */
export interface ModuleContext {
  /** The module's own folder for what it stores (userData/module-data/<id>). */
  dataDir: string
  /** Answers the module page's `invoke(name, input)`. The module validates its own input. */
  handle: (name: string, handler: Handler) => void
  engine: { http: (request: unknown) => Promise<unknown> }
  /** The system's folder chooser, over Talyx's window: the chosen folder, or null if cancelled. */
  pickFolder: (options?: { title?: string }) => Promise<string | null>
  log: ModuleLog
}

interface ModuleLog {
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

interface ModuleMain {
  activate?: (context: ModuleContext) => unknown
  deactivate?: () => unknown
}

export interface ModuleHostDeps {
  /** userData: modules live in modules/<id>/, their data in module-data/<id>/. */
  root: string
  keys: SigningKeys
  fetch: typeof fetch
  /** The saved license key (settings.json), read and written only through the host. */
  licenseKey: { read: () => string | null; write: (key: string | null) => void }
  engineHttp: (request: unknown) => Promise<unknown>
  /** Opens the folder chooser with this title; resolves to the folder, or null if cancelled. */
  pickFolder: (title: string) => Promise<string | null>
  log: ModuleLog
  publish: (state: ModulesState) => void
  now: () => number
}

interface Loaded {
  name: string
  version: string
  status: ModuleStatus
  problem: string | null
  bundle: ModuleBundle | null
  handlers: Map<string, Handler>
  deactivate: (() => unknown) | null
  /** Its start timed out: whatever it still does reaches nothing (no actions, no engine). */
  retired: boolean
}

export type ModuleHost = ReturnType<typeof createModuleHost>

/**
 * Installs, loads and runs modules. Nothing runs without a valid, unexpired license, and nothing
 * runs that the module key did not sign: the signature is checked on install and again on every
 * load, so a file changed or dropped into userData by anything else is refused.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function createModuleHost(deps: ModuleHostDeps) {
  let license: LicenseSummary | null = null
  let expiryTimer: ReturnType<typeof setTimeout> | null = null
  const loaded = new Map<string, Loaded>()
  // Every change to the license or to what is installed runs here, one after another, so an
  // install can never interleave with Remove license, another key or a second install.
  let queue: Promise<unknown> = Promise.resolve()

  function state(): ModulesState {
    const current = activeLicense()
    if (!current) return { license: null, modules: [] }
    const modules = [...loaded].sort(byKeyOrder(current)).flatMap(([id, module]) => {
      if (!unlocksModule(current, id)) return []
      const { name, version, status, problem, bundle } = module
      return [{ id, name, version, status, problem, styled: !!bundle?.files['style.css'] }]
    })
    return { license: current, modules }
  }

  /** After startup, with the window already open: the saved license and the modules it unlocks. */
  function start(): Promise<ModulesState> {
    return serial(async () => {
      const key = deps.licenseKey.read()
      if (!key) return state()
      try {
        setLicense(readLicense(key, deps.keys, deps.now()))
      } catch (error) {
        // An expired key stays saved: Settings then has nothing to show, and a new key replaces it.
        deps.log.warn('[Modules] The saved license is not valid:', errorMessage(error))
        return state()
      }
      await loadLicensed()
      return changed()
    })
  }

  function activate(key: string): Promise<ModulesState> {
    return serial(async () => {
      const next = readLicense(key, deps.keys, deps.now())
      deps.licenseKey.write(key.trim())
      await unloadAll()
      setLicense(next)
      deps.log.info(`[Modules] License ${next.id} activated`)
      await loadLicensed()
      return changed()
    })
  }

  /** Forgets the license; installed files stay, so the same key later needs no download. */
  function deactivate(): Promise<ModulesState> {
    return serial(async () => {
      await unloadAll()
      setLicense(null)
      deps.licenseKey.write(null)
      return changed()
    })
  }

  async function available(): Promise<AvailableModule[]> {
    const current = requireLicense()
    const catalog = await fetchCatalog(deps.fetch, savedKey())
    return catalog
      .filter((entry) => unlocksModule(current, entry.id))
      .map(({ id, name, version, apiVersion }) => ({
        id,
        name,
        version,
        compatible: apiVersion === MODULE_API_VERSION
      }))
  }

  /** Install or update: download, check the signature, swap the folder in whole, load. */
  function install(id: string): Promise<ModulesState> {
    return serial(async () => {
      if (!unlocksModule(requireLicense(), id))
        throw new ModuleError('Your license does not include this module.')
      const { files, bundle } = await download(id)
      const dir = moduleDir(id)
      await stage(dir, files)
      await unload(id)
      try {
        await swapIn(dir)
        deps.log.info(`[Modules] Installed ${id} ${bundle.version}`)
      } finally {
        // The new version, or the old one back after a failed swap.
        await load(id)
        deps.publish(state())
      }
      return state()
    })
  }

  /**
   * On resume from sleep: timers paused, so a key that expired meanwhile is handled now, and one
   * still valid gets its timer set again from the real clock.
   */
  function recheckExpiry(): Promise<void> {
    return serial(expire)
  }

  /** On quit: give every module its deactivate, best effort, without touching the license. */
  function stopAll(): Promise<void> {
    return serial(unloadAll)
  }

  /** Removes the module's code; its data folder stays, so a reinstall picks up where it was. */
  function uninstall(id: string): Promise<ModulesState> {
    return serial(async () => {
      await unload(id)
      await remove(moduleDir(id))
      deps.log.info(`[Modules] Uninstalled ${id}`)
      return changed()
    })
  }

  async function invoke(id: string, name: string, input: unknown): Promise<unknown> {
    const handler = running(id)?.handlers.get(name)
    if (!handler) throw new ModuleError(`The module has no "${name}" action.`)
    return handler(input)
  }

  /** A running module's file for the page, or null (unknown module, file or not running). */
  function file(id: string, name: string): { body: string; type: string } | null {
    const files = running(id)?.bundle?.files
    if (!files || !Object.hasOwn(CONTENT_TYPES, name) || !Object.hasOwn(files, name)) return null
    const body = files[name as keyof ModuleBundle['files']]
    return body === undefined ? null : { body, type: CONTENT_TYPES[name]! }
  }

  function serial<T>(change: () => Promise<T>): Promise<T> {
    const run = queue.then(change)
    queue = run.catch(() => undefined)
    return run
  }

  function activeLicense(): LicenseSummary | null {
    return license && !isExpired(license, deps.now()) ? license : null
  }

  function requireLicense(): LicenseSummary {
    const current = activeLicense()
    if (!current) throw new ModuleError('No license is active.')
    return current
  }

  /** The download server checks the same key the license was read from. */
  function savedKey(): string {
    const key = deps.licenseKey.read()
    if (!key) throw new ModuleError('No license is active.')
    return key
  }

  function running(id: string): Loaded | null {
    const module = loaded.get(id)
    const current = activeLicense()
    return current && unlocksModule(current, id) && module?.status === 'running' ? module : null
  }

  function setLicense(next: LicenseSummary | null): void {
    license = next
    watchExpiry(next?.expires ?? null)
  }

  /** At the end of the key's last day its modules stop, without waiting for a restart. */
  function watchExpiry(expires: string | null): void {
    if (expiryTimer) clearTimeout(expiryTimer)
    expiryTimer = null
    if (expires === null) return
    const wait = expiryTime(expires) - deps.now()
    expiryTimer = setTimeout(
      () => (wait > MAX_TIMER_MS ? watchExpiry(expires) : void serial(expire)),
      Math.min(Math.max(wait, 0), MAX_TIMER_MS)
    )
    expiryTimer.unref?.()
  }

  async function expire(): Promise<void> {
    if (!license) return
    if (!isExpired(license, deps.now())) return watchExpiry(license.expires)
    deps.log.info(`[Modules] License ${license.id} expired`)
    await unloadAll()
    setLicense(null)
    changed()
  }

  async function download(id: string): Promise<{ files: InstalledFiles; bundle: ModuleBundle }> {
    const entry = (await fetchCatalog(deps.fetch, savedKey())).find(
      (candidate) => candidate.id === id
    )
    if (!entry) throw new ModuleError('This module is not available for download.')
    if (entry.apiVersion !== MODULE_API_VERSION)
      throw new ModuleError('This module needs a different version of Talyx.')
    const bytes = await fetchBundleBytes(deps.fetch, entry.url, savedKey())
    const bundle = readBundle(bytes, entry.signature, deps.keys)
    if (bundle.id !== id) throw new ModuleError('The download is a different module.')
    // The signature proves who built a bundle, not that it is current: an old signed one served
    // again must not replace a newer install.
    const installed = loaded.get(id)?.bundle?.version
    if (installed && isOlderVersion(bundle.version, installed))
      throw new ModuleError('The download is older than the installed version.')
    return { files: { bytes, signature: entry.signature }, bundle }
  }

  /** Loads what is installed, not what the key names: a key for every module names none. */
  async function loadLicensed(): Promise<void> {
    for (const id of await installedModuleIds()) await load(id)
  }

  /** A modules folder that cannot be listed loads nothing; the app and the license still start. */
  async function installedModuleIds(): Promise<string[]> {
    try {
      const ids = await installedIds(join(deps.root, MODULES_FOLDER))
      return ids.filter((id) => ModuleIdSchema.safeParse(id).success)
    } catch (error) {
      deps.log.error('[Modules] The installed modules could not be listed:', error)
      return []
    }
  }

  async function load(id: string): Promise<void> {
    const current = activeLicense()
    if (!current || !unlocksModule(current, id)) return
    let files: InstalledFiles | null
    try {
      files = await readInstalled(moduleDir(id))
    } catch (error) {
      loaded.set(id, { ...blankModule(id), problem: errorMessage(error) })
      deps.log.error(`[Modules] ${id} could not be read:`, error)
      return
    }
    if (files) loaded.set(id, await startModule(id, files))
  }

  async function startModule(id: string, files: InstalledFiles): Promise<Loaded> {
    const module = blankModule(id)
    try {
      const bundle = readBundle(files.bytes, files.signature, deps.keys)
      if (bundle.id !== id) throw new ModuleError('The installed files are a different module.')
      Object.assign(module, { bundle, name: bundle.name, version: bundle.version })
      if (bundle.apiVersion !== MODULE_API_VERSION)
        return {
          ...module,
          status: 'incompatible',
          problem: 'This version needs a different version of Talyx.'
        }
      const main = runMain(id, bundle)
      module.deactivate = main.deactivate ?? null
      const started = Promise.resolve().then(() => main.activate?.(contextFor(id, module)))
      await withinTimeout(started, 'start').catch((error: unknown) => {
        if (error instanceof ModuleTimeoutError) retireWhenSettled(id, module, started)
        throw error
      })
      module.status = 'running'
      deps.log.info(`[Modules] Started ${id} ${bundle.version}`)
    } catch (error) {
      module.problem = errorMessage(error)
      deps.log.error(`[Modules] ${id} did not start:`, error)
    }
    return module
  }

  /**
   * A start that timed out may still finish later and start things. It is cut off from the engine
   * at once (its actions are already unreachable: it never counts as running), and its deactivate
   * runs once that start settles, whatever happened to the module since, even after a reinstall.
   */
  function retireWhenSettled(id: string, module: Loaded, started: Promise<unknown>): void {
    const stop = module.deactivate
    module.retired = true
    module.deactivate = null
    void started
      .catch(() => undefined)
      .then(() => stop?.())
      .catch((error: unknown) => deps.log.warn(`[Modules] ${id} did not stop cleanly:`, error))
  }

  async function unload(id: string): Promise<void> {
    const module = loaded.get(id)
    loaded.delete(id)
    try {
      await withinTimeout(
        Promise.resolve().then(() => module?.deactivate?.()),
        'stop'
      )
    } catch (error) {
      // Its handlers are gone either way; a failed cleanup must not block an update.
      deps.log.warn(`[Modules] ${id} did not stop cleanly:`, error)
    }
  }

  async function unloadAll(): Promise<void> {
    for (const id of [...loaded.keys()]) await unload(id)
  }

  function contextFor(id: string, module: Loaded): ModuleContext {
    return {
      dataDir: join(deps.root, 'module-data', id),
      handle: (name, handler) => {
        if (!ModuleActionSchema.safeParse(name).success)
          throw new ModuleError(`"${name}" is not a valid action name.`)
        module.handlers.set(name, handler)
      },
      engine: {
        http: (request) =>
          module.retired
            ? Promise.reject(new ModuleError('The module was stopped.'))
            : deps.engineHttp(request)
      },
      pickFolder: (options) =>
        module.retired
          ? Promise.reject(new ModuleError('The module was stopped.'))
          : deps.pickFolder(folderTitle(options?.title)),
      log: deps.log
    }
  }

  function moduleDir(id: string): string {
    return join(deps.root, MODULES_FOLDER, id)
  }

  function changed(): ModulesState {
    const next = state()
    deps.publish(next)
    return next
  }

  return {
    state,
    start,
    activate,
    deactivate,
    available,
    install,
    uninstall,
    invoke,
    file,
    recheckExpiry,
    stopAll
  }
}

/** The order the key names its modules; a module it does not name (a key for every module) by id. */
function byKeyOrder(license: LicenseSummary) {
  const place = (id: string): number => {
    const named = license.modules.indexOf(id)
    return named === -1 ? license.modules.length : named
  }
  return ([a]: [string, Loaded], [b]: [string, Loaded]): number =>
    place(a) - place(b) || a.localeCompare(b)
}

function blankModule(id: string): Loaded {
  return {
    name: id,
    version: '',
    status: 'failed',
    problem: null,
    bundle: null,
    handlers: new Map(),
    deactivate: null,
    retired: false
  }
}

/** A module's own start or stop, given up on after LIFECYCLE_TIMEOUT_MS. */
async function withinTimeout(work: Promise<unknown>, verb: 'start' | 'stop'): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const seconds = LIFECYCLE_TIMEOUT_MS / 1000
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new ModuleTimeoutError(`The module did not ${verb} within ${seconds} seconds.`)),
      LIFECYCLE_TIMEOUT_MS
    )
  })
  try {
    await Promise.race([work, timeout])
  } finally {
    clearTimeout(timer)
  }
}

const DEFAULT_FOLDER_TITLE = 'Choose a folder'
const MAX_FOLDER_TITLE = 200

/** A module names the chooser; anything that is not a short string gets the plain title. */
function folderTitle(title: unknown): string {
  return typeof title === 'string' && title.trim() && title.length <= MAX_FOLDER_TITLE
    ? title.trim()
    : DEFAULT_FOLDER_TITLE
}

/** Compares x.y.z; a pre-release suffix is ignored, so 1.0.0-beta counts as 1.0.0. */
function isOlderVersion(candidate: string, installed: string): boolean {
  const parts = (version: string): number[] => version.split('-')[0]!.split('.').map(Number)
  const [a, b] = [parts(candidate), parts(installed)]
  const differs = a.findIndex((part, index) => part !== b[index])
  return differs !== -1 && a[differs]! < b[differs]!
}

/**
 * Runs a module's main.js as a CommonJS body. It may require Node's built-ins only: anything else
 * it needs is bundled into it, and Talyx's own modules (and electron) reach it only through the
 * context.
 */
function runMain(id: string, bundle: ModuleBundle): ModuleMain {
  const code = bundle.files['main.js']
  if (code === undefined) return {}
  const module = { exports: {} as ModuleMain }
  const requireBuiltin = (name: string): unknown => {
    const builtin = process.getBuiltinModule(name)
    if (!builtin)
      throw new ModuleError(`A module can only require Node's built-ins, not "${name}".`)
    return builtin
  }
  const body = compileFunction(code, ['module', 'exports', 'require'], {
    filename: `${MODULE_SCHEME}://${id}/main.js`
  })
  body(module, module.exports, requireBuiltin)
  return module.exports
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
