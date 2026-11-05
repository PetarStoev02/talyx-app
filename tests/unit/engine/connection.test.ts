import { afterEach, describe, expect, it, vi } from 'vitest'
import { installFakeEngineApi } from './fakeEngineApi'

describe('engine connection state', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('should not count a socket that never opened as lost', async () => {
    installFakeEngineApi(() => ({}))
    const { useEngine } = await import('@app/providers/useEngine')
    expect(useEngine.getState()).toMatchObject({ everConnected: false, lostAt: null })
  })

  it('should date a lost socket from the drop and clear it when the redial opens', async () => {
    const { dropAll } = installFakeEngineApi(() => ({}))
    const { host } = await import('@shared/engine/host')
    const { useEngine } = await import('@app/providers/useEngine')
    await host.connect()
    expect(useEngine.getState()).toMatchObject({ everConnected: true, lostAt: null })

    const before = Date.now()
    dropAll()
    const lostAt = useEngine.getState().lostAt
    expect(lostAt).toBeGreaterThanOrEqual(before)

    await vi.waitFor(() => expect(useEngine.getState().connection).toBe('open'), { timeout: 2000 })
    expect(useEngine.getState().lostAt).toBeNull()
    host.disconnect()
  })
})
