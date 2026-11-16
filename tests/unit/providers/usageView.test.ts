import { beforeEach, describe, expect, it } from 'vitest'
import { useUsageView } from '../../../src/renderer/src/features/providers/usageView'
import type { EngineApiRequest } from '../../../src/renderer/src/shared/engine/http'
import { HOME, providersDouble } from './providersDouble'
import type { ProvidersDouble } from './providersDouble'

describe('the Usage page', () => {
  let engine: ProvidersDouble

  beforeEach(() => {
    engine = providersDouble()
    useUsageView.setState({ days: 30, provider: null, shown: null, loading: false, problem: null })
  })

  it('should show the report of the latest period when an older load finishes last', async () => {
    engine.profiles[HOME].usage = [
      { model: 'm', provider: 'custom', input_tokens: 7, output_tokens: 0, api_calls: 1 }
    ]
    let releaseOld: () => void = () => {}
    const held = new Promise<void>((resolve) => (releaseOld = resolve))
    const http = engine.http
    // The week's load is held until the month's has landed, and reports a different total.
    engine.http = async <T>(request: EngineApiRequest): Promise<T> => {
      if (!request.path.includes('days=7')) return http<T>(request)
      await held
      if (!request.path.startsWith('/api/analytics/models')) return http<T>(request)
      const week = [
        { model: 'm', provider: 'custom', input_tokens: 999, output_tokens: 0, api_calls: 9 }
      ]
      return { models: week } as T
    }

    useUsageView.getState().setDays(7)
    const old = useUsageView.getState().load(engine.backend)
    useUsageView.getState().setDays(30)
    await useUsageView.getState().load(engine.backend)
    releaseOld()
    await old

    expect(useUsageView.getState().shown).toMatchObject({
      days: 30,
      report: { total: { tokens: 7, requests: 1 } }
    })
    expect(useUsageView.getState().days).toBe(30)
  })

  it('should keep showing the last period while the next one loads, and say it is loading', async () => {
    await useUsageView.getState().load(engine.backend)
    const shown = useUsageView.getState().shown
    let release: () => void = () => {}
    const held = new Promise<void>((resolve) => (release = resolve))
    const http = engine.http
    engine.http = async <T>(request: EngineApiRequest): Promise<T> => {
      await held
      return http<T>(request)
    }

    useUsageView.getState().setDays(7)
    const next = useUsageView.getState().load(engine.backend)
    expect(useUsageView.getState()).toMatchObject({ shown, loading: true })
    release()
    await next

    expect(useUsageView.getState()).toMatchObject({ shown: { days: 7 }, loading: false })
  })

  it('should keep the problem of a load that failed, and clear it on the next', async () => {
    engine.http = () => Promise.reject(new Error('engine down'))
    await useUsageView.getState().load(engine.backend)
    expect(useUsageView.getState().problem).toBeInstanceOf(Error)

    engine = providersDouble()
    await useUsageView.getState().load(engine.backend)
    expect(useUsageView.getState()).toMatchObject({ problem: null, shown: expect.anything() })
  })
})
