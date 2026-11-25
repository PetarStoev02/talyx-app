import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AvailableModule, ModulesState } from '../../../src/shared/modules'

const api = vi.hoisted(() => ({ available: vi.fn(), state: vi.fn(), onState: vi.fn() }))
vi.mock('@shared/api/ipc', () => ({ modulesApi: api }))
vi.mock('@shared/lib/report', () => ({ reportError: vi.fn() }))

import { useModules } from '@features/modules/store'

const licensed: ModulesState = {
  license: { id: 'k', name: 'Ada', modules: ['workflows'], expires: null },
  modules: []
}
const catalog: AvailableModule[] = [
  { id: 'workflows', name: 'Workflows', version: '0.6.1', compatible: true }
]
const HOUR = 3_600_000

describe('module catalog', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Far past the previous test's read, so each test starts with a stale catalog.
    vi.setSystemTime(Date.now() + 10 * HOUR)
    api.available.mockReset().mockResolvedValue(catalog)
    useModules.setState({ state: licensed, catalog: null, catalogFailed: false })
  })

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
    await useModules.getState().readCatalog(HOUR)
    vi.advanceTimersByTime(HOUR + 1)
    await useModules.getState().readCatalog(HOUR)
    expect(api.available).toHaveBeenCalledTimes(2)
  })

  it('should keep the last catalog when a read fails', async () => {
    await useModules.getState().readCatalog(0)
    api.available.mockRejectedValueOnce(new Error('offline'))
    await useModules.getState().readCatalog(0)
    expect(useModules.getState()).toMatchObject({ catalog, catalogFailed: true })
  })
})
