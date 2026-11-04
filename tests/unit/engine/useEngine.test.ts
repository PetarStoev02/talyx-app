import { afterEach, describe, expect, it, vi } from 'vitest'

describe('engine status', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('should ask main once when two screens check the engine at the same time', async () => {
    const getEngineStatus = vi.fn(async () => ({ state: 'missing', enginePath: null }))
    vi.stubGlobal('window', { api: { getEngineStatus } })
    const { useEngine } = await import('@app/providers/useEngine')
    await Promise.all([useEngine.getState().check(), useEngine.getState().check()])
    expect(getEngineStatus).toHaveBeenCalledTimes(1)
    expect(useEngine.getState().status).toEqual({ state: 'missing', enginePath: null })
  })
})
