import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { compileFunction } from 'node:vm'
import {
  MODULE_API_VERSION,
  MODULE_SCHEME,
  type AvailableModule,
  type LicenseSummary,
  type ModuleStatus,
  type ModulesState
} from '../../../shared/modules'
import { ModuleActionSchema } from '../ipc/validation'
import { fetchBytes, fetchCatalog } from './catalog'
import { readBundle, readLicense, type ModuleBundle, type SigningKeys } from './signing'

const BUNDLE_FILE = 'bundle.json'
const SIGNATURE_FILE = 'bundle.sig'
const CONTENT_TYPES: Record<string, string> = {
  'renderer.js': 'text/javascript',
  'style.css': 'text/css'
}

export class ModuleError extends Error {
  override name = 'ModuleError'
}

type Handler = (input: unknown) => unknown

/** What a module's main.js gets from Talyx: the whole contract on the main side. */
export interface ModuleContext {
  /** The module's own folder for what it stores (userData/module-data/<id>). */
  dataDir: string
  /** Answers the module page's `invoke(name, input)`. The module validates its own input. */
  handle: (name: string, handler: Handler) => void
  engine: { http: (request: unknown) => Promise<unknown> }
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
}

export type ModuleHost = ReturnType<typeof createModuleHost>

/**
 * Installs, loads and runs modules. Nothing runs without a valid license, and nothing runs that
 * the module key did not sign: the signature is checked on install and again on every load, so a
 * file changed or dropped into userData by anything else is refused.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function createModuleHost(deps: ModuleHostDeps) {
  let license: LicenseSummary | null = null
  const loaded = new Map<string, Loaded>()

  function state(): ModulesState {
    if (!license) return { license: null, modules: [] }
    const modules = license.modules.flatMap((id) => {
      const module = loaded.get(id)
      if (!module) return []
      const { name, version, status, problem, bundle } = module
      return [{ id, name, version, status, problem, styled: !!bundle?.files['style.css'] }]
    })
    return { license, modules }
  }

  /** At startup: the saved license, then every installed module it unlocks. */
  async function start(): Promise<void> {
    const key = deps.licenseKey.read()
    if (!key) return
    try {
      license = readLicense(key, deps.keys, deps.now())
    } catch (error) {
      // An expired key stays saved: Settings then has nothing to show, and a new key replaces it.
      deps.log.warn('[Modules] The saved license is not valid:', errorMessage(error))
      return
    }
    await loadLicensed()
  }

  async function activate(key: string): Promise<ModulesState> {
    const next = readLicense(key, deps.keys, deps.now())
    deps.licenseKey.write(key.trim())
    await unloadAll()
    license = next
    deps.log.info(`[Modules] License ${next.id} activated`)
    await loadLicensed()
    return changed()
  }

  /** Forgets the license; installed files stay, so the same key later needs no download. */
  async function deactivate(): Promise<ModulesState> {
    await unloadAll()
    license = null
    deps.licenseKey.write(null)
    return changed()
  }

  async function available(): Promise<AvailableModule[]> {
    const unlocked = requireLicense().modules
    const catalog = await fetchCatalog(deps.fetch)
    return catalog
      .filter((entry) => unlocked.includes(entry.id))
      .map(({ id, name, version, apiVersion }) => ({
        id,
        name,
        version,
        compatible: apiVersion === MODULE_API_VERSION
      }))
  }

  /** Install or update: download, check the signature, swap the folder in whole, load. */
  async function install(id: string): Promise<ModulesState> {
    if (!requireLicense().modules.includes(id))
      throw new ModuleError('Your license does not include this module.')
    const entry = (await fetchCatalog(deps.fetch)).find((candidate) => candidate.id === id)
    if (!entry) throw new ModuleError('This module is not available for download.')
    if (entry.apiVersion !== MODULE_API_VERSION)
      throw new ModuleError('This module needs a different version of Talyx.')
    const bytes = await fetchBytes(deps.fetch, entry.url)
    const bundle = readBundle(bytes, entry.signature, deps.keys)
    if (bundle.id !== id) throw new ModuleError('The download is a different module.')

    const dir = moduleDir(id)
    const staging = `${dir}.tmp`
    await rm(staging, { recursive: true, force: true })
    await mkdir(staging, { recursive: true })
    await writeFile(join(staging, BUNDLE_FILE), bytes)
    await writeFile(join(staging, SIGNATURE_FILE), entry.signature)
    await unload(id)
    // A crash between these two leaves no module, never half of one.
    await rm(dir, { recursive: true, force: true })
    await rename(staging, dir)
    deps.log.info(`[Modules] Installed ${id} ${bundle.version}`)
    await load(id)
    return changed()
  }

  /** Removes the module's code; its data folder stays, so a reinstall picks up where it was. */
  async function uninstall(id: string): Promise<ModulesState> {
    await unload(id)
    await rm(moduleDir(id), { recursive: true, force: true })
    deps.log.info(`[Modules] Uninstalled ${id}`)
    return changed()
  }

  async function invoke(id: string, name: string, input: unknown): Promise<unknown> {
    const handler = running(id)?.handlers.get(name)
    if (!handler) throw new ModuleError(`The module has no "${name}" action.`)
    return handler(input)
  }

  /** A running module's file for the page, or null (unknown module, file or not running). */
  function file(id: string, name: string): { body: string; type: string } | null {
    const type = CONTENT_TYPES[name]
    const body = running(id)?.bundle?.files[name as keyof ModuleBundle['files']]
    return type && body !== undefined ? { body, type } : null
  }

  function running(id: string): Loaded | null {
    const module = loaded.get(id)
    return license?.modules.includes(id) && module?.status === 'running' ? module : null
  }

  function requireLicense(): LicenseSummary {
    if (!license) throw new ModuleError('No license is active.')
    return license
  }

  async function loadLicensed(): Promise<void> {
    for (const id of license?.modules ?? []) await load(id)
  }

  async function load(id: string): Promise<void> {
    const dir = moduleDir(id)
    let bytes: Buffer
    let signature: string
    try {
      bytes = await readFile(join(dir, BUNDLE_FILE))
      signature = await readFile(join(dir, SIGNATURE_FILE), 'utf8')
    } catch {
      // Not installed: a licensed module the user has not installed yet.
      return
    }
    const module: Loaded = {
      name: id,
      version: '',
      status: 'failed',
      problem: null,
      bundle: null,
      handlers: new Map(),
      deactivate: null
    }
    loaded.set(id, module)
    try {
      const bundle = readBundle(bytes, signature, deps.keys)
      if (bundle.id !== id) throw new ModuleError('The installed files are a different module.')
      Object.assign(module, { bundle, name: bundle.name, version: bundle.version })
      if (bundle.apiVersion !== MODULE_API_VERSION) {
        module.status = 'incompatible'
        module.problem = 'This version needs a different version of Talyx.'
        return
      }
      const main = runMain(id, bundle)
      module.deactivate = main.deactivate ?? null
      await main.activate?.(contextFor(id, module))
      module.status = 'running'
      deps.log.info(`[Modules] Started ${id} ${bundle.version}`)
    } catch (error) {
      module.status = 'failed'
      module.problem = errorMessage(error)
      deps.log.error(`[Modules] ${id} did not start:`, error)
    }
  }

  async function unload(id: string): Promise<void> {
    const module = loaded.get(id)
    loaded.delete(id)
    try {
      await module?.deactivate?.()
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
      engine: { http: deps.engineHttp },
      log: deps.log
    }
  }

  function moduleDir(id: string): string {
    return join(deps.root, 'modules', id)
  }

  function changed(): ModulesState {
    const next = state()
    deps.publish(next)
    return next
  }

  return { state, start, activate, deactivate, available, install, uninstall, invoke, file }
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
