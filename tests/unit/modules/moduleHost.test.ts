import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CATALOG_URL } from '../../../src/main/infrastructure/modules/catalog'
import {
  createModuleHost,
  type ModuleHost
} from '../../../src/main/infrastructure/modules/moduleHost'
import type { ModulesState } from '../../../src/shared/modules'
import { LICENSE, helloBundle, issueKey, newSigner, signBundle, type TestSigner } from './moduleKit'

const BUNDLE_URL = 'https://downloads.example/hello-1.0.0.json'

describe('module host', () => {
  let root: string
  let signer: TestSigner
  let savedKey: string | null
  let published: ModulesState[]
  let files: Map<string, Buffer | object>
  let host: ModuleHost

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'talyx-modules-'))
    signer = newSigner()
    savedKey = null
    published = []
    files = new Map()
    host = newHost()
    ;(globalThis as { helloStopped?: number }).helloStopped = 0
  })

  afterEach(() => rm(root, { recursive: true, force: true }))

  function newHost(): ModuleHost {
    return createModuleHost({
      root,
      keys: signer.keys,
      fetch: fakeFetch,
      licenseKey: { read: () => savedKey, write: (key) => (savedKey = key) },
      engineHttp: async () => null,
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      publish: (state) => published.push(state),
      now: () => Date.parse('2026-11-08T12:00:00Z')
    })
  }

  const fakeFetch = (async (url: string) => {
    const body = files.get(url)
    if (body === undefined) return new Response(null, { status: 404, statusText: 'Not Found' })
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
      expect((globalThis as { helloStopped?: number }).helloStopped).toBe(1)
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

  describe('at the next start', () => {
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
