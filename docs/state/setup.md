# Setup steps

Drawn from `src/renderer/src/features/setup/steps.ts` by `tests/unit/stateCharts.test.ts`, which fails when this file is stale. Do not edit it by hand; regenerate it with `UPDATE_STATE_CHARTS=1 npx vitest run tests/unit/stateCharts.test.ts`.

An edge is labelled with its event, then in brackets the cases that take it when not every case of its state does. `via` names a state the code passes through on the way.

```mermaid
stateDiagram-v2
  [*] --> engine : engine not current
  [*] --> done : engine current, provider, own bot
  [*] --> bot : engine current, provider, no own bot
  [*] --> provider : engine current, no provider
  engine --> done : provider, own bot
  engine --> bot : provider, no own bot
  engine --> provider : no provider
  provider --> done : own bot
  provider --> bot : no own bot
  bot --> done
```

`[*]` is Get started on the welcome screen; `done` is no step left.
