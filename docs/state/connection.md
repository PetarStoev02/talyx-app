# Engine connection state

Drawn from `src/renderer/src/shared/engine/host.ts` and `src/renderer/src/shared/engine/json-rpc-gateway.ts` by `tests/unit/stateCharts.test.ts`, which fails when this file is stale. Do not edit it by hand; regenerate it with `UPDATE_STATE_CHARTS=1 npx vitest run tests/unit/stateCharts.test.ts`.

An edge is labelled with its event, then in brackets the cases that take it when not every case of its state does. `via` names a state the code passes through on the way.

```mermaid
stateDiagram-v2
  [*] --> idle
  idle --> connecting : connect
  idle --> connecting : retry now
  connecting --> closed : disconnect
  connecting --> closed : drop on purpose
  connecting --> open : socket opens
  connecting --> closed : open fails via error
  connecting --> error : no answer in 15 s via closed
  open --> closed : disconnect
  open --> closed : drop on purpose
  open --> closed : socket closes
  open --> closed : no answer in 45 s
  closed --> connecting : connect
  closed --> connecting : retry now
  closed --> connecting : backoff elapses (redial waiting)
  error --> connecting : connect
  error --> connecting : retry now
  error --> connecting : backoff elapses (redial waiting)
```

Redial n waits a random time below its ceiling: 300 ms, 600 ms, 1.2 s, 2.4 s, 4.8 s, 9.6 s for n = 0 to 5, and 15 s from n = 6 on. A socket that stayed open 5 s sets n back to 0; any other drop or failed dial adds one, so the first redial after a failed dial is n = 1.
