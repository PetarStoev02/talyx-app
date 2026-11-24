import fc from 'fast-check'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyEvent,
  fromHistory,
  needsRebuild
} from '../../../src/renderer/src/features/chat/transcript'
import type { GatewayEvent } from '../../../src/renderer/src/shared/engine/shared'
import { installFakeEngineApi } from '../engine/fakeEngineApi'
import { turnFrames } from './turnFrames'

const SESSION = 's'
// The session's replay epoch, and the one a restarted engine numbers its frames under.
const EPOCH = 'e1'
const RESTARTED = 'e2'
// Each step settles in a few event-loop turns; a short wait lets a failure shrink to its seed.
const SETTLED = { timeout: 1000 }

const asFrame = (event: GatewayEvent): object => ({
  jsonrpc: '2.0',
  method: 'event',
  params: event
})
const transcriptOf = (events: GatewayEvent[]): ReturnType<typeof fromHistory> =>
  events.reduce(applyEvent, fromHistory(SESSION, [], false))

// How a redial goes: the frames seen live before the drop (at least one is left for the replay),
// where the engine's replay window starts (at or before the watermark, so it repeats frames) and
// ends, the live frames that follow (some again), whether they come while the replay is on its way
// or once the session is subscribed again, and how the engine answers the replay: the window, a
// window it no longer holds, or a restart under a new epoch.
const stamped = turnFrames(SESSION).map((frames) =>
  frames.map((event) => ({ ...event, replay_epoch: EPOCH }))
)
const redial = stamped.chain((clean) =>
  fc.record({
    clean: fc.constant(clean),
    seen: fc.integer({ min: 1, max: clean.length - 1 }),
    from: fc.nat(),
    to: fc.nat(),
    again: fc.array(fc.nat(), { maxLength: 4 }),
    liveAfterResume: fc.boolean(),
    answer: fc.constantFrom('window', 'lost', 'restarted')
  })
)

describe('chat transcript across a redial, through the real gateway client', () => {
  afterEach(() => {
    vi.resetModules()
    vi.doUnmock('@shared/engine/reconnect-backoff')
  })

  it('should show the clean transcript after a redial, or ask for a rebuild when the window is gone', async () => {
    await fc.assert(
      fc.asyncProperty(redial, async (run) => {
        const { clean, seen, from, to, again, liveAfterResume, answer } = run
        vi.resetModules()
        vi.doMock('@shared/engine/reconnect-backoff', async (importOriginal) => ({
          ...(await importOriginal<typeof import('@shared/engine/reconnect-backoff')>()),
          reconnectBackoffDelayMs: () => 0
        }))
        const start = from % seen
        const end = seen + (to % (clean.length - seen + 1))
        const live = [...clean.slice(end), ...again.map((index) => clean[index % clean.length])]
        let resumes = 0
        let replayed = false
        const { dropAll, opened } = installFakeEngineApi((frame, socket) => {
          const push = (events: GatewayEvent[]): void =>
            events.forEach((event) => socket.push(asFrame(event)))
          if (frame.method === 'session.resume') {
            resumes += 1
            // The first subscription streams the frames seen before the drop; the one after the
            // redial streams what follows, when the engine sends it then.
            if (resumes === 1) push(clean.slice(0, seen))
            if (resumes === 2 && liveAfterResume && answer === 'window') push(live)
            return {
              session_id: SESSION,
              stored_session_id: SESSION,
              revision: 1,
              replay_epoch: EPOCH
            }
          }
          if (frame.method === 'session.events.since') {
            replayed = true
            // The engine's own answer: a window it no longer holds (ring truncated) or one asked
            // under another epoch (it restarted) is `snapshot_required`, with its current epoch.
            const epoch = answer === 'restarted' ? RESTARTED : EPOCH
            if (answer !== 'window')
              return {
                events: [],
                epoch,
                replay_epoch: epoch,
                latest_seq: clean.length,
                truncated: true,
                snapshot_required: true
              }
            // Live frames that come while the replay is on its way: the client parks and gates them.
            if (!liveAfterResume) push(live)
            return {
              events: clean.slice(start, end),
              epoch,
              replay_epoch: epoch,
              latest_seq: clean.length,
              truncated: false,
              snapshot_required: false
            }
          }
          return {}
        })
        const { host } = await import('@shared/engine/host')
        const received: GatewayEvent[] = []
        host.onEvent((event) => {
          if (event.session_id === SESSION) received.push(event)
        })
        try {
          await host.connect()
          await host.request('default', 'session.resume', { session_id: SESSION })
          await vi.waitFor(() => expect(received).toHaveLength(seen), SETTLED)

          dropAll()
          await vi.waitFor(() => expect(replayed).toBe(true), SETTLED)
          await vi.waitFor(() => expect(opened.length).toBe(2), SETTLED)
          if (answer === 'window') {
            await vi.waitFor(
              () => expect(transcriptOf(received)).toEqual(transcriptOf(clean)),
              SETTLED
            )
            expect(received.filter(needsRebuild)).toEqual([])
            // The transcript drops a stale seq itself; the client must not send one at all.
            const seqs = received.map((event) => event.seq ?? 0)
            expect(seqs).toEqual([...new Set(seqs)].sort((a, b) => a - b))
          } else {
            await vi.waitFor(() => expect(received.some(needsRebuild)).toBe(true), SETTLED)
          }
        } finally {
          host.disconnect()
        }
      }),
      { numRuns: 30 }
    )
  }, 120_000)
})
