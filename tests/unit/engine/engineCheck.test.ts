import { afterEach, describe, expect, it, vi } from 'vitest'
import type { useEngine as UseEngine } from '@app/providers/useEngine'

const MISSING = { state: 'missing', enginePath: null, version: null, reason: null }

describe('checking for the engine', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  async function engineStore(getEngineStatus: () => Promise<unknown>): Promise<typeof UseEngine> {
    vi.stubGlobal('window', {
      api: {
        getEngineStatus,
        onEngineSocketFrame: () => () => {},
        onEngineSocketClosed: () => () => {}
      }
    })
    return (await import('@app/providers/useEngine')).useEngine
  }

  it('should not report a check before the first one', async () => {
    const useEngine = await engineStore(() => Promise.resolve(MISSING))
    expect(useEngine.getState().checkedAt).toBeNull()
  })

  it('should record when each check finished, so the page can say when it last checked', async () => {
    const useEngine = await engineStore(() => Promise.resolve(MISSING))
    const before = Date.now()
    await useEngine.getState().check()
    const first = useEngine.getState().checkedAt
    expect(first).toBeGreaterThanOrEqual(before)

    await new Promise((resolve) => setTimeout(resolve, 5))
    await useEngine.getState().check()
    expect(useEngine.getState().checkedAt).toBeGreaterThan(first ?? 0)
  })

  it('should record a check that failed too', async () => {
    const useEngine = await engineStore(() => Promise.reject(new Error('spawn failed')))
    await useEngine.getState().check()
    expect(useEngine.getState()).toMatchObject({ status: { state: 'error' } })
    expect(useEngine.getState().checkedAt).not.toBeNull()
  })
})
