import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GatewayEvent } from '@shared/engine/shared'
import { installFakeEngineApi } from './fakeEngineApi'

function event(params: Partial<GatewayEvent> & { type: string }): object {
  return { jsonrpc: '2.0', method: 'event', params }
}

describe('engine host', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('should route a request to the profile it names over the one shared socket', async () => {
    const { sent, opened } = installFakeEngineApi(() => ({ profiles: [] }))
    const { host } = await import('@shared/engine/host')
    await host.connect()
    await host.request('cfo', 'profiles.list', {})
    expect(opened).toEqual(['default'])
    expect(sent.at(-1)).toMatchObject({ method: 'profiles.list', params: { profile: 'cfo' } })
    host.disconnect()
  })

  it('should keep a call in flight when a second screen connects again', async () => {
    let answer: ((value: unknown) => void) | null = null
    installFakeEngineApi(() => new Promise((resolve) => (answer = resolve)))
    const { host } = await import('@shared/engine/host')
    await host.connect()
    const pending = host.request('default', 'profiles.list', {})
    await vi.waitFor(() => expect(answer).not.toBeNull())
    await host.connect()
    answer?.({ profiles: [] })
    await expect(pending).resolves.toEqual({ profiles: [] })
    host.disconnect()
  })

  it('should redial after a dropped socket, replay the events it missed and resume its sessions', async () => {
    const { sent, opened, dropAll } = installFakeEngineApi((frame, socket) => {
      // Any call will do to make the fake stream one live frame of session `s`.
      if (frame.method === 'profiles.list') {
        socket.push(event({ type: 'message.delta', session_id: 's', seq: 1, payload: {} }))
        return { profiles: [] }
      }
      if (frame.method === 'session.resume') {
        return { session_id: 's', stored_session_id: 's', revision: 1, execution_generation: 1 }
      }
      if (frame.method === 'session.events.since') {
        return { events: [{ type: 'message.complete', session_id: 's', seq: 2, payload: {} }] }
      }
      return {}
    })
    const { host } = await import('@shared/engine/host')
    const seen: Array<[string, boolean]> = []
    host.onEvent((e) => seen.push([e.type, Boolean(e.replayed)]))
    await host.connect()
    await host.request('default', 'session.resume', { session_id: 's' })
    await host.request('default', 'profiles.list', {})
    await vi.waitFor(() => expect(seen).toContainEqual(['message.delta', false]))

    dropAll()

    await vi.waitFor(() => expect(opened).toHaveLength(2), { timeout: 3000 })
    await vi.waitFor(() => expect(seen).toContainEqual(['message.complete', true]))
    expect(sent.find((frame) => frame.method === 'session.events.since')?.params).toMatchObject({
      session_id: 's',
      last_seen: 1
    })
    // The redialed socket subscribes the open session again, or its live frames stop.
    await vi.waitFor(() =>
      expect(
        sent.filter((frame) => frame.method === 'session.resume').at(-1)?.params
      ).toMatchObject({
        session_id: 's',
        defer_history: true
      })
    )
    expect(sent.filter((frame) => frame.method === 'session.resume')).toHaveLength(2)
    host.disconnect()
  })
})
