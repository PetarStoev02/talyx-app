import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AvailableModule, ModulesState } from '../../../src/shared/modules'

const api = vi.hoisted(() => ({
  available: vi.fn(),
  install: vi.fn(),
  uninstall: vi.fn(),
  state: vi.fn(),
  onState: vi.fn()
}))
const toast = vi.hoisted(() => ({ error: vi.fn() }))
vi.mock('@shared/api/ipc', () => ({ modulesApi: api }))
vi.mock('@shared/lib/report', () => ({ reportError: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

import { useModules } from '@features/modules/store'
import { HOUR_MS } from '@shared/lib/time'

const licensed: ModulesState = {
  license: { id: 'k', name: 'Ada', modules: ['workflows'], expires: null },
  modules: []
}
const catalog: AvailableModule[] = [
  { id: 'workflows', name: 'Workflows', version: '0.6.1', compatible: true }
]

// A promise the test settles by hand, to finish two reads in either order.
function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: Error) => void
} {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)))
  return { promise, resolve, reject }
}

describe('module store', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Far past the previous test's read, so each test starts with a stale catalog.
    vi.setSystemTime(Date.now() + 10 * HOUR_MS)
    api.available.mockReset().mockResolvedValue(catalog)
    api.install.mockReset().mockResolvedValue(licensed)
    toast.error.mockReset()
    useModules.setState({ state: licensed, catalog: null, catalogFailed: false, changing: null })
  })

  describe('catalog', () => {
    it('should send nothing without a license', async () => {
      useModules.setState({ state: { license: null, modules: [] } })
      await useModules.getState().readCatalog(0)
      expect(api.available).not.toHaveBeenCalled()
    })

    it('should keep what the catalog offers for the update button and the Modules page', async () => {
      await useModules.getState().readCatalog(0)
      expect(useModules.getState().catalog).toEqual(catalog)
    })

    it('should not read again before the last read is older than the given age', async () => {
      await useModules.getState().readCatalog(0)
      await useModules.getState().readCatalog(HOUR_MS)
      vi.advanceTimersByTime(HOUR_MS + 1)
      await useModules.getState().readCatalog(HOUR_MS)
      expect(api.available).toHaveBeenCalledTimes(2)
    })

    it('should keep the last catalog when a read fails', async () => {
      await useModules.getState().readCatalog(0)
      api.available.mockRejectedValueOnce(new Error('offline'))
      await useModules.getState().readCatalog(0)
      expect(useModules.getState()).toMatchObject({ catalog, catalogFailed: true })
    })

    it('should keep the newer answer when an older read fails after it', async () => {
      const older = deferred<AvailableModule[]>()
      api.available.mockReturnValueOnce(older.promise)
      const first = useModules.getState().readCatalog(0)
      await useModules.getState().readCatalog(0)
      older.reject(new Error('offline'))
      await first
      expect(useModules.getState()).toMatchObject({ catalog, catalogFailed: false })
    })
  })

  describe('changes', () => {
    it('should not start a second install while one runs', async () => {
      const running = deferred<ModulesState>()
      api.install.mockReturnValueOnce(running.promise)
      const first = useModules.getState().install('workflows')
      expect(useModules.getState().changing).toBe('workflows')
      await useModules.getState().install('workflows')
      running.resolve(licensed)
      await first
      expect(api.install).toHaveBeenCalledTimes(1)
      expect(useModules.getState().changing).toBeNull()
    })

    it('should report a failed install and free the button again', async () => {
      api.install.mockRejectedValueOnce(new Error('bad signature'))
      await useModules.getState().install('workflows')
      expect(toast.error.mock.calls[0]?.[0]).toBe('Talyx could not change the module.')
      expect(useModules.getState().changing).toBeNull()
    })
  })
})
