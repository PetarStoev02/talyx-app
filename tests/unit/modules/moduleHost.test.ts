import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CATALOG_URL, MAX_BUNDLE_BYTES } from '../../../src/main/infrastructure/modules/catalog'
import {
  createModuleHost,
  type ModuleHost
} from '../../../src/main/infrastructure/modules/moduleHost'
import { ALL_MODULES, type ModulesState } from '../../../src/shared/modules'
import {
  LICENSE,
  helloBundle,
  helloRuns,
  issueKey,
  newSigner,
  resetHelloRuns,
  signBundle,
  type TestSigner
} from './moduleKit'

const BUNDLE_URL = new URL('/bundles/hello-1.0.0.json', CATALOG_URL).href
const NOON = Date.parse('2026-11-08T12:00:00Z')
const HOUR_MS = 60 * 60_000

describe('module host', () => {
  let root: string
  let signer: TestSigner
  let savedKey: string | null
  let published: ModulesState[]
  let files: Map<string, Buffer | ReadableStream | object>
  let host: ModuleHost
  let clock: number
  /** The download server's answer to any key: false stands for a key it has revoked. */
  let serverAcceptsKey: boolean
  /** Set to hold the bundle download until the test releases it. */
  let heldDownload: Promise<void> | null
  let engineHttp: ReturnType<typeof vi.fn>
  let pickFolder: ReturnType<typeof vi.fn>
  /** What every request to the download server was sent with. */
  let requests: RequestInit[]

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'talyx-modules-'))
    signer = newSigner()
    savedKey = null
    published = []
    files = new Map()
    clock = NOON
    heldDownload = null
    requests = []
    serverAcceptsKey = true
    engineHttp = vi.fn(async () => null)
    pickFolder = vi.fn(async () => '/Users/ada/Code/api')
    host = newHost()
    resetHelloRuns()
  })

  afterEach(async () => {
    vi.useRealTimers()
    await rm(root, { recursive: true, force: true })
  })

  function newHost(): ModuleHost {
    return createModuleHost({
      root,
      keys: signer.keys,
      fetch: fakeFetch,
      licenseKey: { read: () => savedKey, write: (key) => (savedKey = key) },
      engineHttp,
      pickFolder,
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      publish: (state) => published.push(state),
      now: () => clock
    })
  }

  /** The download server: it answers only the saved license key. */
  const fakeFetch = (async (url: string, init?: RequestInit) => {
    requests.push(init ?? {})
    const authorization = new Headers(init?.headers).get('authorization')
    if (!serverAcceptsKey || authorization !== `Bearer ${savedKey}`)
      return new Response(null, { status: 401, statusText: 'Unauthorized' })
    if (url === BUNDLE_URL && heldDownload) await heldDownload
    const body = files.get(url)
    if (body === undefined) return new Response(null, { status: 404, statusText: 'Not Found' })
    if (body instanceof ReadableStream) return new Response(body)
    return new Response(Buffer.isBuffer(body) ? new Uint8Array(body) : JSON.stringify(body))
  }) as typeof fetch

  /** Publishes a bundle and the catalog entry pointing at it, as the release script would. */
  function publish(bundle: object, entry: object = {}): void {
    const { bytes, signature } = signBundle(signer, bundle)
    files.set(BUNDLE_URL, bytes)
    const { id, name, version, apiVersion } = bundle as Record<string, unknown>
    files.set(CATALOG_URL, {
      modules: [{ id, name, version, apiVersion, url: BUNDLE_URL, signature, ...entry }]
    })
  }

  async function installHello(): Promise<ModulesState> {
    publish(helloBundle())
    await host.activate(issueKey(signer))
    return host.install('hello')
  }

  describe('without a license', () => {
    it('should show no license and no modules', async () => {
      await host.start()
      expect(host.state()).toEqual({ license: null, modules: [] })
    })

    it('should refuse an invalid key and save nothing', async () => {
      await expect(host.activate('TALYX-nope.nope')).rejects.toThrow('This key is not valid.')
      expect(savedKey).toBeNull()
      expect(published).toEqual([])
    })

    it('should refuse to list or install modules', async () => {
      await expect(host.available()).rejects.toThrow('No license is active.')
      await expect(host.install('hello')).rejects.toThrow('No license is active.')
    })
  })

  describe('given an active license', () => {
    it('should save the key and announce the license', async () => {
      const key = issueKey(signer)
      const state = await host.activate(`${key}\n`)
      expect(savedKey).toBe(key)
      expect(state).toEqual({ license: { ...LICENSE, v: undefined }, modules: [] })
      expect(published).toEqual([state])
    })

    it('should list only the catalog modules the license unlocks, marking what this Talyx can run', async () => {
      const other = signBundle(signer, helloBundle({ id: 'other' }))
      files.set(CATALOG_URL, {
        modules: [
          entryFor(helloBundle({ apiVersion: 99 })),
          { ...entryFor(helloBundle({ id: 'other' })), signature: other.signature }
        ]
      })
      await host.activate(issueKey(signer))
      expect(await host.available()).toEqual([
        { id: 'hello', name: 'Hello', version: '1.0.0', compatible: false }
      ])
    })

    it('should install a module, run its main side and serve its page', async () => {
      const state = await installHello()
      expect(state.modules).toEqual([
        {
          id: 'hello',
          name: 'Hello',
          version: '1.0.0',
          status: 'running',
          problem: null,
          styled: false
        }
      ])
      expect(await host.invoke('hello', 'greet', { name: 'Ada' })).toBe('hello Ada from a/b')
      expect(host.file('hello', 'renderer.js')).toEqual({
        body: 'export default function Hello() {}',
        type: 'text/javascript'
      })
      expect(host.file('hello', 'main.js')).toBeNull()
    })

    it('should refuse a download whose signature does not match and leave nothing installed', async () => {
      publish(helloBundle())
      files.set(BUNDLE_URL, Buffer.from(JSON.stringify(helloBundle({ name: 'Evil' }))))
      await host.activate(issueKey(signer))
      await expect(host.install('hello')).rejects.toThrow('The module is not signed by Talyx.')
      expect(existsSync(join(root, 'modules', 'hello'))).toBe(false)
    })

    it('should never let the license key follow a redirect to another server', async () => {
      publish(helloBundle())
      await host.activate(issueKey(signer))
      await host.install('hello')
      expect(requests.length).toBeGreaterThan(1)
      expect(requests.every((init) => init.redirect === 'error')).toBe(true)
    })

    it('should refuse a catalog that points the download at another server', async () => {
      publish(helloBundle(), { url: 'https://elsewhere.example/hello-1.0.0.json' })
      await host.activate(issueKey(signer))
      await expect(host.install('hello')).rejects.toThrow(
        'The module list points to a download Talyx does not trust.'
      )
    })

    it('should explain when the download server refuses the license key', async () => {
      publish(helloBundle())
      await host.activate(issueKey(signer))
      serverAcceptsKey = false
      await expect(host.available()).rejects.toThrow(
        'The module server did not accept this license key.'
      )
    })

    it('should refuse a module the license does not unlock', async () => {
      await host.activate(issueKey(signer, { ...LICENSE, modules: [] }))
      await expect(host.install('hello')).rejects.toThrow(
        'Your license does not include this module.'
      )
    })

    it('should refuse a catalog version made for another Talyx', async () => {
      publish(helloBundle({ apiVersion: 99 }))
      await host.activate(issueKey(signer))
      await expect(host.install('hello')).rejects.toThrow(
        'This module needs a different version of Talyx.'
      )
    })

    it.each([
      ['its own title', '{ title: "Where is acme/api?" }', 'Where is acme/api?'],
      ['no title', 'undefined', 'Choose a folder'],
      ['a title that is not text', '{ title: 42 }', 'Choose a folder']
    ])('should let a module ask for a folder with %s', async (_, options, title) => {
      const main = `module.exports = { activate(ctx) { ctx.handle('pick', () => ctx.pickFolder(${options})) } }`
      publish(helloBundle({ files: { 'renderer.js': '', 'main.js': main } }))
      await host.activate(issueKey(signer))
      await host.install('hello')
      expect(await host.invoke('hello', 'pick', null)).toBe('/Users/ada/Code/api')
      expect(pickFolder).toHaveBeenCalledWith(title)
    })

    it('should mark a module whose main side throws as failed and keep the app going', async () => {
      publish(helloBundle({ files: { 'renderer.js': '', 'main.js': 'throw new Error("boom")' } }))
      await host.activate(issueKey(signer))
      const state = await host.install('hello')
      expect(state.modules[0]).toMatchObject({ status: 'failed', problem: 'boom' })
      expect(host.file('hello', 'renderer.js')).toBeNull()
      await expect(host.invoke('hello', 'greet', {})).rejects.toThrow(
        'The module has no "greet" action.'
      )
    })

    it('should let a module require only Node built-ins', async () => {
      const main = 'require("electron")'
      publish(helloBundle({ files: { 'renderer.js': '', 'main.js': main } }))
      await host.activate(issueKey(signer))
      const state = await host.install('hello')
      expect(state.modules[0]!.problem).toBe(
        'A module can only require Node\'s built-ins, not "electron".'
      )
    })

    it('should stop the old version before an update and run the new one', async () => {
      await installHello()
      publish(helloBundle({ version: '1.1.0' }))
      const state = await host.install('hello')
      expect(helloRuns().stopped).toBe(1)
      expect(state.modules[0]).toMatchObject({ version: '1.1.0', status: 'running' })
    })

    it('should uninstall the code and keep the module data', async () => {
      await installHello()
      await mkdir(join(root, 'module-data', 'hello'), { recursive: true })
      const state = await host.uninstall('hello')
      expect(state.modules).toEqual([])
      expect(existsSync(join(root, 'modules', 'hello'))).toBe(false)
      expect(existsSync(join(root, 'module-data', 'hello'))).toBe(true)
    })

    it('should hide the modules when the license is removed and keep their files', async () => {
      await installHello()
      const state = await host.deactivate()
      expect(state).toEqual({ license: null, modules: [] })
      expect(savedKey).toBeNull()
      expect(host.file('hello', 'renderer.js')).toBeNull()
      expect(existsSync(join(root, 'modules', 'hello', 'bundle.json'))).toBe(true)
    })
  })

  describe('given a license for every module', () => {
    const EVERY_MODULE = { ...LICENSE, modules: [ALL_MODULES] }

    it('should list every catalog module, also ones made after the key', async () => {
      files.set(CATALOG_URL, {
        modules: [entryFor(helloBundle()), entryFor(helloBundle({ id: 'later', name: 'Later' }))]
      })
      await host.activate(issueKey(signer, EVERY_MODULE))
      expect((await host.available()).map((module) => module.id)).toEqual(['hello', 'later'])
    })

    it('should install and run a module the key does not name', async () => {
      publish(helloBundle())
      await host.activate(issueKey(signer, EVERY_MODULE))
      const state = await host.install('hello')
      expect(state.modules).toMatchObject([{ id: 'hello', status: 'running' }])
      expect(await host.invoke('hello', 'greet', { name: 'Bo' })).toBe('hello Bo from a/b')
    })

    it('should run every installed module at the next start', async () => {
      publish(helloBundle())
      await host.activate(issueKey(signer, EVERY_MODULE))
      await host.install('hello')
      const restarted = newHost()
      await restarted.start()
      expect(restarted.state().modules).toMatchObject([{ id: 'hello', status: 'running' }])
    })

    it('should put back a version left aside by an update that was cut short', async () => {
      publish(helloBundle())
      await host.activate(issueKey(signer, EVERY_MODULE))
      await host.install('hello')
      await rename(join(root, 'modules', 'hello'), join(root, 'modules', 'hello.old'))
      const restarted = newHost()
      await restarted.start()
      expect(restarted.state().modules).toMatchObject([{ id: 'hello', status: 'running' }])
    })

    it('should stop its modules when a key for other modules replaces it', async () => {
      publish(helloBundle())
      await host.activate(issueKey(signer, EVERY_MODULE))
      await host.install('hello')
      const state = await host.activate(issueKey(signer, { ...LICENSE, modules: ['other'] }))
      expect(state.modules).toEqual([])
      expect(host.file('hello', 'renderer.js')).toBeNull()
    })

    it('should skip what is in the modules folder but is not a module', async () => {
      publish(helloBundle())
      await host.activate(issueKey(signer, EVERY_MODULE))
      await host.install('hello')
      await writeFile(join(root, 'modules', '.DS_Store'), '')
      await writeFile(join(root, 'modules', 'notes'), 'a file, not a module folder')
      const restarted = newHost()
      await restarted.start()
      expect(restarted.state().modules.map((module) => module.id)).toEqual(['hello'])
    })
  })

  describe('given installed modules', () => {
    /** Installs `id` as a signed copy of hello, as an earlier key would have left it. */
    async function leaveInstalled(id: string, overrides: object = {}): Promise<void> {
      const { bytes, signature } = signBundle(signer, helloBundle({ id, ...overrides }))
      await mkdir(join(root, 'modules', id), { recursive: true })
      await writeFile(join(root, 'modules', id, 'bundle.json'), bytes)
      await writeFile(join(root, 'modules', id, 'bundle.sig'), signature)
    }

    /** A module whose main side reports its own start, so a test can read the start order. */
    function reportingStart(id: string): object {
      return {
        files: {
          'renderer.js': 'export default function Page() {}',
          'main.js': `module.exports = { activate() { globalThis.moduleStarted('${id}') } }`
        }
      }
    }

    it('should start them in the order the key names them', async () => {
      const started: string[] = []
      Object.assign(globalThis, { moduleStarted: (id: string) => started.push(id) })
      await leaveInstalled('alpha', reportingStart('alpha'))
      await leaveInstalled('zeta', reportingStart('zeta'))
      savedKey = issueKey(signer, { ...LICENSE, modules: ['zeta', 'alpha'] })
      await host.start()
      expect(started).toEqual(['zeta', 'alpha'])
    })

    it('should not start a module the saved license does not unlock', async () => {
      await leaveInstalled('hello')
      savedKey = issueKey(signer, { ...LICENSE, modules: ['other'] })
      await host.start()
      expect(host.state().modules).toEqual([])
      expect(helloRuns().started).toBe(0)
    })

    it('should list them in the order the key names them', async () => {
      await leaveInstalled('alpha')
      await leaveInstalled('zeta')
      savedKey = issueKey(signer, { ...LICENSE, modules: ['zeta', 'alpha'] })
      await host.start()
      expect(host.state().modules.map((module) => module.id)).toEqual(['zeta', 'alpha'])
    })

    it('should list them by id for a license for every module', async () => {
      await leaveInstalled('zeta')
      await leaveInstalled('alpha')
      savedKey = issueKey(signer, { ...LICENSE, modules: [ALL_MODULES] })
      await host.start()
      expect(host.state().modules.map((module) => module.id)).toEqual(['alpha', 'zeta'])
    })

    it('should start with no modules when the modules folder cannot be listed', async () => {
      await writeFile(join(root, 'modules'), 'a file where the folder belongs')
      savedKey = issueKey(signer, { ...LICENSE, modules: [ALL_MODULES] })
      const state = await host.start()
      expect(state).toMatchObject({ license: { id: LICENSE.id }, modules: [] })
    })

    it('should start and show a named module as failed when its folder cannot be read', async () => {
      await writeFile(join(root, 'modules'), 'a file where the folder belongs')
      savedKey = issueKey(signer)
      const state = await host.start()
      expect(state).toMatchObject({
        license: { id: LICENSE.id },
        modules: [{ id: 'hello', status: 'failed' }]
      })
    })
  })

  describe('given changes that overlap', () => {
    it('should stop a module whose install finished after the license was removed', async () => {
      publish(helloBundle())
      await host.activate(issueKey(signer))
      let release = (): void => undefined
      heldDownload = new Promise((resolve) => (release = resolve))
      const installing = host.install('hello')
      const removing = host.deactivate()
      release()
      await Promise.all([installing, removing])
      expect(host.state()).toEqual({ license: null, modules: [] })
      expect(helloRuns()).toEqual({ started: 1, stopped: 1 })
      await expect(host.invoke('hello', 'greet', { name: 'x' })).rejects.toThrow()
    })

    it('should run two installs of one module one after the other', async () => {
      publish(helloBundle())
      await host.activate(issueKey(signer))
      await Promise.all([host.install('hello'), host.install('hello')])
      expect(host.state().modules).toMatchObject([{ id: 'hello', status: 'running' }])
      expect(helloRuns()).toEqual({ started: 2, stopped: 1 })
    })

    it('should stop a module that a new key no longer unlocks', async () => {
      await installHello()
      const state = await host.activate(issueKey(signer, { ...LICENSE, modules: [] }))
      expect(state.modules).toEqual([])
      expect(helloRuns().stopped).toBe(1)
      expect(host.file('hello', 'renderer.js')).toBeNull()
    })
  })

  describe('given a key with an end date', () => {
    it('should stop its modules at the end of the last day while Talyx runs', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      publish(helloBundle())
      await host.activate(issueKey(signer, { ...LICENSE, expires: '2026-11-08' }))
      await host.install('hello')
      clock = NOON + 12 * HOUR_MS
      await vi.advanceTimersByTimeAsync(12 * HOUR_MS)
      expect(host.state()).toEqual({ license: null, modules: [] })
      expect(published.at(-1)).toEqual({ license: null, modules: [] })
      expect(helloRuns().stopped).toBe(1)
      await expect(host.install('hello')).rejects.toThrow('No license is active.')
    })
  })

  describe('given the computer slept past the end of the key', () => {
    it('should stop its modules when Talyx wakes', async () => {
      publish(helloBundle())
      await host.activate(issueKey(signer, { ...LICENSE, expires: '2026-11-08' }))
      await host.install('hello')
      clock = NOON + 24 * HOUR_MS
      await host.recheckExpiry()
      expect(published.at(-1)).toEqual({ license: null, modules: [] })
      expect(helloRuns().stopped).toBe(1)
    })
  })

  describe('given the computer slept but woke before the end of the key', () => {
    it('should still stop its modules at the end of the last day', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      publish(helloBundle())
      await host.activate(issueKey(signer, { ...LICENSE, expires: '2026-11-08' }))
      await host.install('hello')
      clock = NOON + 6 * HOUR_MS
      await host.recheckExpiry()
      expect(helloRuns().stopped).toBe(0)
      clock = NOON + 12 * HOUR_MS
      await vi.advanceTimersByTimeAsync(6 * HOUR_MS)
      expect(published.at(-1)).toEqual({ license: null, modules: [] })
      expect(helloRuns().stopped).toBe(1)
    })
  })

  describe('when Talyx quits', () => {
    it('should give every running module its deactivate and keep the license', async () => {
      await installHello()
      await host.stopAll()
      expect(helloRuns().stopped).toBe(1)
      expect(savedKey).not.toBeNull()
    })
  })

  describe('given a module that misbehaves', () => {
    it('should give up on a module that never finishes starting and keep going', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      const main = 'module.exports = { activate: () => new Promise(() => {}) }'
      publish(helloBundle({ files: { 'renderer.js': '', 'main.js': main } }))
      await host.activate(issueKey(signer))
      let settled = false
      const installing = host.install('hello').finally(() => (settled = true))
      while (!settled) await vi.advanceTimersByTimeAsync(1_000)
      expect((await installing).modules[0]).toMatchObject({
        status: 'failed',
        problem: 'The module did not start within 10 seconds.'
      })
    })

    it('should cut off a module whose start finishes after it timed out', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      const main = `module.exports = {
        activate: (ctx) => new Promise((resolve) => {
          globalThis.finishStart = () => {
            ctx.handle('late', () => 'late')
            globalThis.lateHttp = ctx.engine.http({ method: 'GET', path: '/x' }).catch((e) => e.message)
            resolve()
          }
        }),
        deactivate() { globalThis.helloStopped = (globalThis.helloStopped ?? 0) + 1 }
      }`
      publish(helloBundle({ files: { 'renderer.js': '', 'main.js': main } }))
      await host.activate(issueKey(signer))
      let settled = false
      const installing = host.install('hello').finally(() => (settled = true))
      while (!settled) await vi.advanceTimersByTimeAsync(1_000)
      await installing
      await host.uninstall('hello')
      expect(helloRuns().stopped).toBe(0)
      ;(globalThis as { finishStart?: () => void }).finishStart!()
      await vi.waitFor(() => expect(helloRuns().stopped).toBe(1))
      await expect(host.invoke('hello', 'late', null)).rejects.toThrow()
      expect(await (globalThis as { lateHttp?: Promise<unknown> }).lateHttp).toBe(
        'The module was stopped.'
      )
      expect(engineHttp).not.toHaveBeenCalled()
    })

    it('should stop reading a download as soon as it passes the size cap', async () => {
      publish(helloBundle())
      const chunk = new Uint8Array(1024 * 1024)
      let pulled = 0
      files.set(
        BUNDLE_URL,
        new ReadableStream({
          pull: (controller) => {
            pulled++
            if (pulled > 100) controller.close()
            else controller.enqueue(chunk)
          }
        })
      )
      await host.activate(issueKey(signer))
      await expect(host.install('hello')).rejects.toThrow(
        'The module download is larger than any module can be.'
      )
      expect(pulled).toBeLessThan(30)
    })

    it('should serve only the module page files, never inherited names', async () => {
      await installHello()
      for (const name of ['constructor', 'toString', '__proto__', 'main.js'])
        expect(host.file('hello', name)).toBeNull()
    })

    it('should refuse a download larger than any module', async () => {
      publish(helloBundle())
      files.set(BUNDLE_URL, Buffer.alloc(MAX_BUNDLE_BYTES + 1))
      await host.activate(issueKey(signer))
      await expect(host.install('hello')).rejects.toThrow(
        'The module download is larger than any module can be.'
      )
    })

    it('should refuse an older signed version over a newer install', async () => {
      publish(helloBundle({ version: '1.2.0' }))
      await host.activate(issueKey(signer))
      await host.install('hello')
      publish(helloBundle({ version: '1.1.9' }))
      await expect(host.install('hello')).rejects.toThrow(
        'The download is older than the installed version.'
      )
      expect(host.state().modules[0]).toMatchObject({ version: '1.2.0', status: 'running' })
    })
  })

  describe('at the next start', () => {
    it('should show an installed module with a missing signature as failed', async () => {
      await installHello()
      await rm(join(root, 'modules', 'hello', 'bundle.sig'))
      const restarted = newHost()
      await restarted.start()
      expect(restarted.state().modules[0]).toMatchObject({
        status: 'failed',
        problem: 'The installed module is incomplete (ENOENT).'
      })
    })

    it('should put back a version left aside by an update that was cut short', async () => {
      await installHello()
      await rename(join(root, 'modules', 'hello'), join(root, 'modules', 'hello.old'))
      const restarted = newHost()
      await restarted.start()
      expect(restarted.state().modules[0]).toMatchObject({ id: 'hello', status: 'running' })
    })

    it('should announce what it started, since the window opens before modules do', async () => {
      await installHello()
      published = []
      const restarted = newHost()
      await restarted.start()
      expect(published).toEqual([restarted.state()])
    })

    it('should run the installed modules the saved license unlocks', async () => {
      await installHello()
      const restarted = newHost()
      await restarted.start()
      expect(restarted.state().modules[0]).toMatchObject({ id: 'hello', status: 'running' })
      expect(await restarted.invoke('hello', 'greet', { name: 'Bo' })).toBe('hello Bo from a/b')
    })

    it('should refuse an installed module changed on disk', async () => {
      await installHello()
      const file = join(root, 'modules', 'hello', 'bundle.json')
      await writeFile(file, (await readFile(file, 'utf8')).replace('"Hello"', '"Evil!"'))
      const restarted = newHost()
      await restarted.start()
      expect(restarted.state().modules[0]).toMatchObject({
        status: 'failed',
        problem: 'The module is not signed by Talyx.'
      })
    })

    it('should load nothing when the saved key has expired', async () => {
      await installHello()
      savedKey = issueKey(signer, { ...LICENSE, expires: '2026-01-01' })
      const restarted = newHost()
      await restarted.start()
      expect(restarted.state()).toEqual({ license: null, modules: [] })
    })
  })

  function entryFor(bundle: object): object {
    const { id, name, version, apiVersion } = bundle as Record<string, unknown>
    return { id, name, version, apiVersion, url: BUNDLE_URL, signature: 'x' }
  }
})
