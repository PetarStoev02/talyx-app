import { describe, expect, it, vi } from 'vitest'
import type { EngineStatus } from '../../../src/shared/engine'

const settings = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }))
vi.mock('@shared/api/ipc', () => ({ settingsApi: settings }))

import {
  firstUndoneStep,
  hasProvider,
  knownFirstStep,
  setupVisibility,
  stepAfter
} from '@features/setup/steps'
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

describe('stepAfter', () => {
  const engine = attached('0.22.5')

  it.each([
    ['the engine, with nothing else done', 'engine', false, false, 'provider'],
    ['the engine, with a provider saved', 'engine', true, false, 'bot'],
    ['the engine, with everything else done', 'engine', true, true, null],
    ['the provider step, with no own bot', 'provider', true, false, 'bot'],
    ['the provider step skipped, with an own bot', 'provider', false, true, null],
    ['the last step', 'bot', false, false, null]
  ] as const)('should skip what is done after %s', (_name, current, hasProv, hasBot, next) => {
    expect(stepAfter(current, { engine, hasProvider: hasProv, hasOwnBot: hasBot })).toBe(next)
  })

  it('should move past an older engine the user chose to keep', () => {
    expect(
      stepAfter('engine', { engine: attached('0.21.0'), hasProvider: false, hasOwnBot: false })
    ).toBe('provider')
  })
})

describe('knownFirstStep', () => {
  it('should name the engine before the other facts can be read', () => {
    expect(knownFirstStep({ engine: missing, hasProvider: null, hasOwnBot: null })).toBe('engine')
  })

  it('should wait for the provider and bot facts once the engine is done', () => {
    const engine = attached('0.22.5')
    expect(knownFirstStep({ engine, hasProvider: null, hasOwnBot: false })).toBeUndefined()
    expect(knownFirstStep({ engine, hasProvider: true, hasOwnBot: null })).toBeUndefined()
  })

  it('should name the first undone step once every fact is known', () => {
    const engine = attached('0.22.5')
    expect(knownFirstStep({ engine, hasProvider: true, hasOwnBot: false })).toBe('bot')
    expect(knownFirstStep({ engine, hasProvider: true, hasOwnBot: true })).toBeNull()
  })
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

  it('should force the flow open from restart until finish', async () => {
    settings.set.mockResolvedValue({})
    useSetup.setState({ setupDone: true, forced: false, hasProvider: true, hasOwnBot: true })
    await useSetup.getState().restart()
    expect(useSetup.getState().forced).toBe(true)
    // Unknown again, so Get started waits for a fresh read.
    expect(useSetup.getState().hasProvider).toBeNull()
    expect(useSetup.getState().hasOwnBot).toBeNull()
    await useSetup.getState().finish()
    expect(useSetup.getState().forced).toBe(false)
  })

  it('should keep setupDone when saving fails', async () => {
    settings.set.mockRejectedValue(new Error('disk full'))
    useSetup.setState({ setupDone: false })
    await expect(useSetup.getState().finish()).rejects.toThrow('disk full')
    expect(useSetup.getState().setupDone).toBe(false)
  })

  it('should remember whether a provider and an own bot exist', () => {
    useSetup.getState().setHasProvider(true)
    useSetup.getState().setHasOwnBot(false)
    expect(useSetup.getState().hasProvider).toBe(true)
    expect(useSetup.getState().hasOwnBot).toBe(false)
  })
})
