import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron-log', () => ({ default: { warn: vi.fn(), info: vi.fn() } }))

import {
  DICTATION_TRANSITIONS,
  type DictationEvent,
  type DictationState
} from '../../src/renderer/src/features/chat/useDictation'
import { stepAfter, type SetupStep } from '../../src/renderer/src/features/setup/steps'
import {
  RECONNECT_STABLE_OPEN_MS,
  reconnectBackoffDelayMs
} from '../../src/renderer/src/shared/engine/reconnect-backoff'
import type { ConnectionState } from '../../src/renderer/src/shared/engine/shared'
import {
  createUpdateStore,
  next,
  type UpdateEvent
} from '../../src/main/infrastructure/updater/updateState'
import {
  EXPECTED_ENGINE_VERSION,
  isEngineCurrent,
  type EngineStatus
} from '../../src/shared/engine'
import type { ReleaseSummary, UpdateFailure, UpdateState } from '../../src/shared/updater'
import { installFakeEngineApi } from './engine/fakeEngineApi'
import { expectCommittedChart, stateDiagram, unionMembers, type Run } from './stateChart'

const UPDATE_STATE = 'src/main/infrastructure/updater/updateState.ts'
const DICTATION = 'src/renderer/src/features/chat/useDictation.ts'
const SETUP_STEPS = 'src/renderer/src/features/setup/steps.ts'
const GATEWAY = 'src/renderer/src/shared/engine/json-rpc-gateway.ts'

const sorted = (values: Iterable<string>): string[] => [...values].sort()

describe('state charts in docs/state', () => {
  describe('update', () => {
    const failures = unionMembers('src/shared/updater.ts', 'UpdateFailure', null) as UpdateFailure[]
    const { runs, reached, start } = exploreUpdates(failures)

    it('should reach every update state from the first one', () => {
      expect(sorted(reached)).toEqual(
        sorted(unionMembers('src/shared/updater.ts', 'UpdateState', 'kind'))
      )
    })

    it('should try every update event', () => {
      expect(sorted(Object.keys(UPDATE_EVENTS))).toEqual(
        sorted(unionMembers(UPDATE_STATE, 'UpdateEvent', 'kind'))
      )
    })

    it('should keep docs/state/update.md the chart of updateState.next', () => {
      expectCommittedChart('update', {
        title: 'Update state',
        sources: [UPDATE_STATE],
        diagram: stateDiagram(runs, start),
        notes: []
      })
    })
  })

  describe('dictation', () => {
    const states = Object.keys(DICTATION_TRANSITIONS) as DictationState[]
    const events = unionMembers(DICTATION, 'DictationEvent', null) as DictationEvent[]
    const runs: Run[] = states.flatMap((from) =>
      events.map((event) => ({
        from,
        event,
        to: DICTATION_TRANSITIONS[from][event] ?? null,
        via: [],
        when: {}
      }))
    )

    it('should give every dictation state a row and every event a move', () => {
      expect(sorted(states)).toEqual(sorted(unionMembers(DICTATION, 'DictationState', null)))
      const used = new Set(runs.filter((run) => run.to !== null).map((run) => run.event))
      expect(sorted(used)).toEqual(sorted(events))
    })

    it('should keep docs/state/dictation.md the chart of DICTATION_TRANSITIONS', () => {
      expectCommittedChart('dictation', {
        title: 'Dictation state',
        sources: [DICTATION],
        diagram: stateDiagram(runs, null),
        notes: []
      })
    })
  })

  describe('setup steps', () => {
    it('should try an engine in every status', () => {
      expect(sorted(Object.keys(ENGINES))).toEqual(
        sorted(unionMembers('src/shared/engine.ts', 'EngineStatus', 'state'))
      )
    })

    it('should keep docs/state/setup.md the chart of stepAfter', () => {
      const steps = unionMembers(SETUP_STEPS, 'SetupStep', null) as SetupStep[]
      const facts = Object.values(ENGINES)
        .flat()
        .flatMap((engine) =>
          [true, false].flatMap((hasProvider) =>
            [true, false].map((hasOwnBot) => ({ engine, hasProvider, hasOwnBot }))
          )
        )
      const runs: Run[] = [null, ...steps].flatMap((from) =>
        facts.map((fact) => ({
          from: from ?? '[*]',
          event: '',
          to: stepAfter(from, fact) ?? 'done',
          via: [],
          when: {
            engine: isEngineCurrent(fact.engine) ? 'engine current' : 'engine not current',
            provider: fact.hasProvider ? 'provider' : 'no provider',
            bot: fact.hasOwnBot ? 'own bot' : 'no own bot'
          }
        }))
      )
      expectCommittedChart('setup', {
        title: 'Setup steps',
        sources: [SETUP_STEPS],
        diagram: stateDiagram(runs, null),
        notes: ['`[*]` is Get started on the welcome screen; `done` is no step left.']
      })
    })
  })

  describe('engine connection', () => {
    afterEach(() => {
      vi.useRealTimers()
      vi.unstubAllGlobals()
      vi.resetModules()
      vi.doUnmock('@shared/engine/reconnect-backoff')
    })

    it('should reach every connection state', async () => {
      expect(sorted(Object.keys(REACH))).toEqual(
        sorted(unionMembers(GATEWAY, 'ConnectionState', null))
      )
      for (const [state, cases] of Object.entries(REACH))
        for (const { path } of cases) {
          const line = await dialAlong(path)
          expect(line.states.at(-1)).toBe(state)
          line.host.disconnect()
        }
    })

    it('should keep docs/state/connection.md the chart of the host over the gateway client', async () => {
      const runs: Run[] = []
      for (const [from, cases] of Object.entries(REACH))
        for (const { when, path } of cases)
          for (const event of Object.keys(CONNECTION_EVENTS)) {
            const line = await dialAlong(path)
            const before = line.states.length
            const label = await act(line, event)
            const hops = line.states.slice(before)
            runs.push({
              from,
              event: label,
              to: hops.at(-1) ?? null,
              via: hops.slice(0, -1),
              when: { when }
            })
            line.host.disconnect()
          }
      const start = (await dialAlong([])).states[0]
      expectCommittedChart('connection', {
        title: 'Engine connection state',
        sources: ['src/renderer/src/shared/engine/host.ts', GATEWAY],
        diagram: stateDiagram(runs, start),
        notes: [backoffNote()]
      })
    })
  })
})

// Update: every state the real `next` reaches from the store's first state, under every event.

const RELEASE: ReleaseSummary = {
  version: '2.0.0',
  url: 'https://example.invalid/v2.0.0',
  publishedAt: '2026-11-01T00:00:00Z',
  highlights: [],
  changes: 1,
  downloadable: true
}

interface UpdateCase {
  when: Record<string, string>
  event: UpdateEvent
}

const found = (when: string, release: ReleaseSummary | null): UpdateCase => ({
  when: { found: when },
  event: { kind: 'found', release }
})
// A release offered both ways: downloaded by Talyx, or only its page.
const bothWays = (release: ReleaseSummary): ReleaseSummary[] =>
  [true, false].map((downloadable) => ({ ...release, downloadable }))

/** Each event Talyx sees, as it can come in `state`. */
const UPDATE_EVENTS: Record<
  UpdateEvent['kind'],
  (state: UpdateState, failures: UpdateFailure[]) => UpdateCase[]
> = {
  found: (state) => {
    const nothing = found('nothing newer', null)
    if (state.kind === 'none')
      return [nothing, ...bothWays(RELEASE).map((release) => found('a release', release))]
    const { release } = state
    const otherVersion = release.version === '2.0.0' ? '2.1.0' : '2.0.0'
    return [
      nothing,
      found('the same release', release),
      // Assets or notes added after publishing; kept to two variants so the search ends.
      ...bothWays({ ...release, changes: 3 - release.changes }).map((changed) =>
        found('a changed release', changed)
      ),
      ...bothWays({ ...release, version: otherVersion }).map((other) =>
        found('another version', other)
      )
    ]
  },
  download: () => [{ when: {}, event: { kind: 'download', total: 0 } }],
  progress: () => [{ when: {}, event: { kind: 'progress', received: 1, total: 2 } }],
  verified: () => [{ when: {}, event: { kind: 'verified' } }],
  failed: (_state, failures) =>
    failures.map((reason) => ({ when: { reason }, event: { kind: 'failed', reason } })),
  cancelled: () => [{ when: {}, event: { kind: 'cancelled' } }]
}

function exploreUpdates(failures: UpdateFailure[]): {
  runs: Run[]
  reached: Set<string>
  start: string
} {
  const first = createUpdateStore({
    download: () => Promise.reject(new Error('not downloaded')),
    publish: () => undefined
  }).current()
  const seen = new Set([JSON.stringify(first)])
  const queue = [first]
  const runs: Run[] = []
  for (const state of queue) {
    const release =
      state.kind === 'none'
        ? {}
        : { release: state.release.downloadable ? 'downloadable' : 'page only' }
    for (const cases of Object.values(UPDATE_EVENTS))
      for (const { when, event } of cases(state, failures)) {
        const after = next(state, event)
        runs.push({
          from: state.kind,
          event: event.kind,
          to: after === state ? null : after.kind,
          via: [],
          when: { ...release, ...when }
        })
        if (!seen.has(JSON.stringify(after))) {
          seen.add(JSON.stringify(after))
          queue.push(after)
        }
      }
  }
  return { runs, reached: new Set(queue.map((state) => state.kind)), start: first.kind }
}

// Setup: `stepAfter` from every step, for an engine in every status and every other fact.

const ENGINES: Record<EngineStatus['state'], EngineStatus[]> = {
  missing: [{ state: 'missing', enginePath: null }],
  error: [{ state: 'error', message: 'failed', version: null, reason: null }],
  attached: [EXPECTED_ENGINE_VERSION, '0.0.1'].map((version) => ({
    state: 'attached',
    version,
    commit: null,
    home: '/engine',
    path: '/engine/bin/talyx-engine',
    stale: false,
    botMetaKey: 'bot',
    botGroupsMetaKey: 'groups',
    managerHandle: 'talyx'
  }))
}

// Engine connection: the real host and gateway client over a fake of main's socket channels, from
// every state under every event. Time moves only when an event says so.

/** The host's backoff, fixed so the chart can tell a redial's timer from the dial timeout. */
const BACKOFF_MS = 1000

interface Line {
  host: (typeof import('../../src/renderer/src/shared/engine/host'))['host']
  states: ConnectionState[]
  /** Dials main has not answered yet. */
  dials: Array<{ open: () => void; refuse: () => void }>
  dropAll: () => void
}

const CONNECTION_EVENTS: Record<string, (line: Line) => Promise<unknown> | void> = {
  connect: (line) => void line.host.connect().catch(() => undefined),
  'retry now': (line) => void line.host.retryNow().catch(() => undefined),
  disconnect: (line) => line.host.disconnect(),
  'drop on purpose': (line) => line.host.dropSocket(),
  'socket opens': (line) => line.dials.shift()?.open(),
  'open fails': (line) => line.dials.shift()?.refuse(),
  'socket closes': (line) => line.dropAll(),
  // The next timer fires: a redial's backoff, the dial timeout, a heartbeat.
  'time passes': () => vi.advanceTimersToNextTimerAsync()
}

/** How to reach each state, by the events that lead there; `when` tells the ways apart. */
const REACH: Record<ConnectionState, Array<{ when: string; path: string[] }>> = {
  idle: [{ when: 'never dialled', path: [] }],
  connecting: [
    { when: 'first dial', path: ['connect'] },
    { when: 'redial', path: ['connect', 'socket opens', 'socket closes', 'time passes'] }
  ],
  open: [{ when: 'open', path: ['connect', 'socket opens'] }],
  closed: [
    { when: 'redial waiting', path: ['connect', 'socket opens', 'socket closes'] },
    { when: 'disconnected', path: ['connect', 'socket opens', 'disconnect'] }
  ],
  error: [
    { when: 'redial waiting', path: ['connect', 'time passes'] },
    { when: 'disconnected', path: ['connect', 'time passes', 'disconnect'] }
  ]
}

async function dialAlong(path: string[]): Promise<Line> {
  vi.useFakeTimers()
  vi.resetModules()
  vi.doMock('@shared/engine/reconnect-backoff', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@shared/engine/reconnect-backoff')>()),
    reconnectBackoffDelayMs: () => BACKOFF_MS
  }))
  const { dropAll } = installFakeEngineApi(() => ({}))
  const api = (
    globalThis as unknown as {
      window: { api: { openEngineSocket: (id: string, profile: string) => Promise<void> } }
    }
  ).window.api
  const answer = api.openEngineSocket
  const dials: Line['dials'] = []
  api.openEngineSocket = (id, profile) =>
    new Promise((resolve, reject) =>
      dials.push({
        open: () => void answer(id, profile).then(resolve),
        refuse: () => reject(new Error('refused'))
      })
    )
  const { host } = await import('@shared/engine/host')
  const line: Line = { host, states: [], dials, dropAll }
  host.onState((state) => line.states.push(state))
  for (const event of path) await act(line, event)
  return line
}

/** Runs `event` and lets the code settle; answers the event's label, naming the timer that fired. */
async function act(line: Line, event: string): Promise<string> {
  const before = Date.now()
  await CONNECTION_EVENTS[event](line)
  for (let turn = 0; turn < 10; turn += 1) await vi.advanceTimersByTimeAsync(0)
  if (event !== 'time passes') return event
  const waited = Date.now() - before
  return waited === BACKOFF_MS ? 'backoff elapses' : `no answer in ${waited / 1000} s`
}

function backoffNote(): string {
  const ladder: number[] = []
  for (let attempt = 0; ; attempt += 1) {
    const ceiling = reconnectBackoffDelayMs(attempt, { jitter: false })
    ladder.push(ceiling)
    if (reconnectBackoffDelayMs(attempt + 1, { jitter: false }) === ceiling) break
  }
  const time = (ms: number): string => (ms < 1000 ? `${ms} ms` : `${ms / 1000} s`)
  return (
    `A redial waits a random time below its attempt's ceiling: ${ladder.slice(0, -1).map(time).join(', ')}, ` +
    `then ${time(ladder.at(-1) ?? 0)} for every attempt after. The count starts again after a socket ` +
    `that stayed open ${time(RECONNECT_STABLE_OPEN_MS)}.`
  )
}
