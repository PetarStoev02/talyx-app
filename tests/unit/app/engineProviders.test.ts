import { describe, expect, it } from 'vitest'
import { engineProvidersBackend } from '../../../src/renderer/src/app/engine/providers'
import type { EngineApiRequest } from '../../../src/renderer/src/shared/engine/http'

// The providers wiring's REST calls that the in-memory double does not look at closely.
function engineRecording(answer: unknown): {
  sent: EngineApiRequest[]
  http: <T>(request: EngineApiRequest) => Promise<T>
} {
  const sent: EngineApiRequest[] = []
  return {
    sent,
    http: async <T>(request: EngineApiRequest) => {
      sent.push(request)
      return answer as T
    }
  }
}

describe('engine providers backend', () => {
  it('should list every profile with an unscoped call', async () => {
    const engine = engineRecording({ profiles: [{ name: 'default' }, { name: 'scout' }] })

    expect(await engineProvidersBackend(engine).profiles()).toEqual(['default', 'scout'])
    expect(engine.sent).toEqual([{ path: '/api/profiles' }])
  })

  it("should hold a sign-in wait open past the engine's long-poll", async () => {
    const engine = engineRecording({ session_id: 's', status: 'denied', error_message: '' })

    expect(
      await engineProvidersBackend(engine).pollSignIn({ providerId: 'acme', sessionId: 's 1' })
    ).toEqual({ status: 'failed', message: 'denied' })
    expect(engine.sent).toEqual([
      {
        path: '/api/providers/oauth/acme/poll/s%201?profile=default&wait=25',
        profile: 'default',
        timeoutMs: 45_000
      }
    ])
  })

  it('should give a sign-in a minute to start', async () => {
    const engine = engineRecording({ flow: 'pkce', session_id: 's' })

    await engineProvidersBackend(engine).startSignIn('acme')

    expect(engine.sent[0]).toMatchObject({
      path: '/api/providers/oauth/acme/start?profile=default',
      method: 'POST',
      timeoutMs: 60_000
    })
  })
})
