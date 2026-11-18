# Dictation state

Drawn from `src/renderer/src/features/chat/useDictation.ts` by `tests/unit/stateCharts.test.ts`, which fails when this file is stale. Do not edit it by hand; regenerate it with `UPDATE_STATE_CHARTS=1 npx vitest run tests/unit/stateCharts.test.ts`.

An edge is labelled with its event, then in brackets the cases that take it when not every case of its state does. `via` names a state the code passes through on the way.

```mermaid
stateDiagram-v2
  [*] --> idle
  idle --> starting : start
  starting --> recording : opened
  starting --> idle : failed
  recording --> transcribing : stopped
  transcribing --> idle : settled
```
