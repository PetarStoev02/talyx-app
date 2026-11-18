import fc from 'fast-check'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyEvent, fromHistory } from '../../../src/renderer/src/features/chat/transcript'
import type { GatewayEvent } from '../../../src/renderer/src/shared/engine/shared'
import { installFakeEngineApi } from '../engine/fakeEngineApi'
import { turnFrames } from './turnFrames'

const SESSION = 's'
// Each step settles in a few event-loop turns; a short wait lets a failure shrink to its seed.
const SETTLED = { timeout: 300 }

const asFrame = (event: GatewayEvent): object => ({
  jsonrpc: '2.0',
  method: 'event',
  params: event
})
const transcriptOf = (events: GatewayEvent[]): ReturnType<typeof fromHistory> =>
  events.reduce(applyEvent, fromHistory(SESSION, [], false))

// How a redial goes: the frames seen live before the drop, where the engine's replay window starts
// (at or before the watermark, so it repeats frames), where it ends, the live frames pushed while
// the replay is in flight (some again), and whether the engine lost the window (a new epoch).
const redial = turnFrames(SESSION).chain((clean) =>
  fc.record({
    clean: fc.constant(clean),
    seen: fc.integer({ min: 1, max: clean.length }),
    from: fc.nat(),
    to: fc.nat(),
    again: fc.array(fc.nat(), { maxLength: 4 }),
    lost: fc.boolean()
  })
)

describe('chat transcript across a redial, through the real gateway client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
    vi.doUnmock('@shared/engine/reconnect-backoff')
  })

  it('should show the clean transcript after a redial, or ask for a rebuild when the window is gone', async () => {
    await fc.assert(
      fc.asyncProperty(redial, async ({ clean, seen, from, to, again, lost }) => {
        vi.resetModules()
        vi.doMock('@shared/engine/reconnect-backoff', async (importOriginal) => ({
          ...(await importOriginal<typeof import('@shared/engine/reconnect-backoff')>()),
          reconnectBackoffDelayMs: () => 0
        }))
        const start = from % seen
        const end = seen + (to % (clean.length - seen + 1))
        let replayed = false
        const { dropAll, opened } = installFakeEngineApi((frame, socket) => {
          // The frames seen before the drop arrive live on the first socket.
          if (frame.method === 'profiles.list')
            for (const event of clean.slice(0, seen)) socket.push(asFrame(event))
          if (frame.method === 'session.resume')
            return { session_id: SESSION, stored_session_id: SESSION, revision: 1 }
          if (frame.method === 'session.events.since') {
            // Live frames go on while the replay is on its way: the client parks and gates them.
            for (const event of clean.slice(end)) socket.push(asFrame(event))
            for (const index of again) socket.push(asFrame(clean[index % clean.length]))
            replayed = true
            return lost
              ? { snapshot_required: true, latest_seq: clean.length }
              : { events: clean.slice(start, end) }
          }
          return {}
        })
        const { host } = await import('@shared/engine/host')
        const received: GatewayEvent[] = []
        host.onEvent((event) => {
          if (event.session_id === SESSION) received.push(event)
        })
        await host.connect()
        await host.request('default', 'session.resume', { session_id: SESSION })
        await host.request('default', 'profiles.list', {})
        await vi.waitFor(() => expect(received).toHaveLength(seen), SETTLED)

        dropAll()
        await vi.waitFor(() => expect(replayed).toBe(true), SETTLED)
        await vi.waitFor(() => expect(opened.length).toBe(2), SETTLED)
        if (lost) {
          await vi.waitFor(
            () => expect(received.map((event) => event.type)).toContain('session.replay_gap'),
            SETTLED
          )
        } else {
          await vi.waitFor(
            () => expect(transcriptOf(received)).toEqual(transcriptOf(clean)),
            SETTLED
          )
        }
        host.disconnect()
      }),
      { numRuns: 30 }
    )
  }, 120_000)
})
