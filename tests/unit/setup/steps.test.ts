import { describe, expect, it, vi } from 'vitest'
import type { EngineStatus } from '../../../src/shared/engine'

const settings = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }))
vi.mock('@shared/api/ipc', () => ({ settingsApi: settings }))

import { firstUndoneStep, hasProvider, setupVisibility } from '@features/setup/steps'
import { useSetup } from '@features/setup/store'

const missing: EngineStatus = { state: 'missing', enginePath: null }
const failed: EngineStatus = { state: 'error', message: 'no socket', version: '0.21.0' }

function attached(version: string): EngineStatus {
  return {
    state: 'attached',
    version,
    commit: null,
    home: '/home',
    stale: false,
    botMetaKey: 'k',
    botGroupsMetaKey: 'g'
  }
}

describe('firstUndoneStep', () => {
  it.each([
    ['a missing engine', missing, false, false, 'engine'],
    ['an engine that could not attach', failed, true, true, 'engine'],
    ['an older engine', attached('0.21.0'), true, true, 'engine'],
    ['no provider yet', attached('0.22.5'), false, false, 'provider'],
    ['no own bot on a newer engine', attached('0.22.10'), true, false, 'bot'],
    ['everything done', attached('0.22.5'), true, true, null]
  ] as const)(
    'should name the first undone step for %s',
    (_name, engine, hasProv, hasBot, step) => {
      expect(firstUndoneStep({ engine, hasProvider: hasProv, hasOwnBot: hasBot })).toBe(step)
    }
  )
})

describe('hasProvider', () => {
  const none = { keys: [], endpoints: [], accounts: [] }

  it('should be false with nothing set up', () => {
    expect(hasProvider(none)).toBe(false)
  })

  it('should be false for key slots without a saved key', () => {
    expect(hasProvider({ ...none, keys: [{ preview: null }] })).toBe(false)
  })

  it('should be true with a saved key', () => {
    expect(hasProvider({ ...none, keys: [{ preview: 'sk-…ab' }] })).toBe(true)
  })

  it('should be true with a signed-in account', () => {
    expect(hasProvider({ ...none, accounts: [{ signedIn: false }, { signedIn: true }] })).toBe(true)
  })

  it('should be true with a custom endpoint', () => {
    expect(hasProvider({ ...none, endpoints: [{}] })).toBe(true)
  })
})

describe('setupVisibility', () => {
  it.each([
    [null, 'engine', 'loading'],
    [false, undefined, 'loading'],
    [false, 'provider', 'show'],
    [false, null, 'hidden'],
    [true, 'engine', 'hidden']
  ] as const)('should be decided for setupDone %s and step %s', (done, step, expected) => {
    expect(setupVisibility(done, step)).toBe(expected)
  })
})

describe('useSetup', () => {
  it('should read setupDone from settings on load', async () => {
    settings.get.mockResolvedValue({ setupDone: true })
    await useSetup.getState().load()
    expect(useSetup.getState().setupDone).toBe(true)
  })

  it('should save and set setupDone on finish and restart', async () => {
    settings.set.mockResolvedValue({})
    await useSetup.getState().finish()
    expect(settings.set).toHaveBeenLastCalledWith({ setupDone: true })
    expect(useSetup.getState().setupDone).toBe(true)
    await useSetup.getState().restart()
    expect(settings.set).toHaveBeenLastCalledWith({ setupDone: false })
    expect(useSetup.getState().setupDone).toBe(false)
  })

  it('should keep setupDone when saving fails', async () => {
    settings.set.mockRejectedValue(new Error('disk full'))
    useSetup.setState({ setupDone: false })
    await expect(useSetup.getState().finish()).rejects.toThrow('disk full')
    expect(useSetup.getState().setupDone).toBe(false)
  })

  it('should remember whether a provider exists', () => {
    useSetup.getState().setHasProvider(true)
    expect(useSetup.getState().hasProvider).toBe(true)
  })
})
