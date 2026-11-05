import { afterEach, describe, expect, it, vi } from 'vitest'
import { installFakeEngineApi } from '../engine/fakeEngineApi'

describe('roster engine access', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('should not exist until the engine reports both metadata keys', async () => {
    installFakeEngineApi(() => ({}))
    const { rosterBackendFor } = await import('@app/providers/useRosterBackend')
    expect(rosterBackendFor({ botMetaKey: null, botGroupsMetaKey: null })).toBeNull()
    expect(rosterBackendFor({ botMetaKey: 'acme-bots', botGroupsMetaKey: null })).toBeNull()
  })

  it('should send roster calls over the shared socket under the profile they name', async () => {
    const { sent } = installFakeEngineApi(() => ({ profiles: [] }))
    const { host } = await import('@shared/engine/host')
    const { rosterBackendFor } = await import('@app/providers/useRosterBackend')
    const backend = rosterBackendFor({ botMetaKey: 'acme-bots', botGroupsMetaKey: 'acme-groups' })
    await host.connect()
    expect(await backend?.request('analyst', 'profiles.list', {})).toEqual({ profiles: [] })
    expect(sent.at(-1)).toMatchObject({ method: 'profiles.list', params: { profile: 'analyst' } })
    expect(backend?.botMetaKey).toBe('acme-bots')
    host.disconnect()
  })
})
