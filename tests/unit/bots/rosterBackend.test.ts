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

  it('should send roster calls over the shared socket and read the bot record under its key', async () => {
    const { sent } = installFakeEngineApi(() => ({
      profiles: [{ name: 'analyst', ui_meta: { 'acme-bots': { title: 'Analyst' } } }]
    }))
    const { host } = await import('@shared/engine/host')
    const { rosterBackendFor } = await import('@app/providers/useRosterBackend')
    const backend = rosterBackendFor({ botMetaKey: 'acme-bots', botGroupsMetaKey: 'acme-groups' })
    await host.connect()
    const bots = await backend?.listBots()
    expect(sent.at(-1)).toMatchObject({ method: 'profiles.list', params: { profile: 'default' } })
    expect(bots?.[0].meta).toEqual({ title: 'Analyst' })
    host.disconnect()
  })
})
