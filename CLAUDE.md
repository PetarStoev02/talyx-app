# CLAUDE.md: Talyx Project Guidelines

> This file is automatically loaded by AI assistants working on this codebase.
> Keep it accurate and up to date. State each rule once; when a check enforces it, the line here
> only points at the check.

## Project Overview

**Talyx** is a desktop app to tally your AI agents: a roster of bots on the left, one chat on
the right, and a manager bot (called Talyx) that delegates to the other bots and briefs you.
The bots run on **the engine**, a separate agent backend the user installs; Talyx is a client
of it and holds no orchestration logic of its own. The screens and their user-facing names are
in the feature map, `.claude/skills/verify-talyx/features/README.md`.

Version 1.1.1. Electron 44, React 19, TypeScript 5.9, TailwindCSS 4, Zustand, shadcn/ui (New
York), electron-vite + electron-builder, Vitest.

### History and plans

- Design (decisions 1–20): `docs/superpowers/specs/2026-11-04-talyx-agents-pivot-design.md`.
- Plan (twelve PRs): `docs/superpowers/specs/2026-11-04-talyx-pivot-plan.html`.
- `docs/superpowers/` is gitignored: specs and plans are local working notes, not in the repo.
- The pivot was squash-merged into `main` at 1.0; work lands as PRs against `main`. The plan's
  PR 12 (remote machines) is still to come.
- The file organizer (0.11.0) is preserved on branch `legacy/file-organizer` and tag
  `v0.11.0-legacy`. Never modify them.

## Commands

```bash
npm run dev              # Start dev mode (Electron + Vite HMR)
npm test                 # Run unit tests (Vitest)
npm run test:smoke       # Real-engine smoke test (opt-in: TALYX_SMOKE_INSTALL_FILE=engine-install.json)
npm run test:watch       # Tests in watch mode
npm run lint             # ESLint on src/ and tests/
npm run typecheck        # TypeScript check (node + web)
npm run format           # Prettier format all files
npm run format:check     # Prettier check (CI runs it)
npm run build            # Typecheck + production build
npm run build:mac        # Build macOS DMG (ARM64 + x64)
npm run build:linux      # Build Linux AppImage + deb (x64)
npm run release          # Signed, notarized DMGs, then a draft GitHub release
npm run sign-release     # Sign the update feeds of the workflow's draft release (owner's machine)
npm run reset            # Delete local app data (settings.json)
```

Builds, signing, updates and releases: `docs/releasing.md`; the steps are the `talyx-release`
skill.

During `npm run dev` the renderer is also usable in a plain browser at
`http://localhost:5173` (dev bridge → real main process).

## Architecture

Main (`src/main/`) runs the engine CLI (`talyx-engine`: the `enginePath` setting, then PATH, then
`~/.local/bin`), attaches with `gateway ensure --json` and mints one-use tickets through the
profile's control socket. Main opens the gateway websocket itself (the gateway admits no Origin
header and takes the ticket in a subprotocol) and relays frames over `engine:socket-*` IPC; REST
goes through `engine:http`. Main never owns or kills the gateway.

`src/shared/` is the contract between main, preload and renderer: `api.ts` is the single
definition of `window.api` (the preload builds it over `ipcRenderer`, the browser dev bridge over
HTTP), `channels.ts` types every channel, and `moduleHost.ts` is the module host contract
(`npm run module-host` writes it to `contract/module-host.d.ts` for the modules repo).

The renderer (`src/renderer/src/`) uses Feature-Sliced Design: `app/` (wiring), `pages/`,
`widgets/`, `features/`, `shared/` (ui, hooks, api, lib, the vendored engine client). Features
speak Talyx's terms; their wiring to engine methods and REST paths is `app/engine/`.

## Enforced by checks

Each line is the rule; the check's message names the fix.

- Layers: each imports only the layers below it, never a sibling slice; the renderer never
  imports `electron` or Node; main, preload, splash and `src/shared` never import the renderer.
  `npm run lint` (`eslint.config.mjs`, cases in `tests/unit/layerBoundaries.test.ts`).
- Imports across layers use the aliases (`@app/*`, `@pages/*`, `@widgets/*`, `@features/*`,
  `@shared/*`, `@renderer/*`, `@contract/*` for `src/shared`), never a relative path.
  `npm run lint`.
- Features name no engine method or REST path (that wiring is `app/engine/`):
  `tests/unit/featureBackends.test.ts`.
- A feature that exports `xActions(backend)` has its tests in `tests/unit/<feature>/`:
  `tests/unit/featureTests.test.ts`.
- TypeScript strict with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`, no `any`,
  explicit return types: `npm run lint` and `npm run typecheck`.
- `infrastructure/modules/signing.ts` imports no Electron and no alias value (the modules repo runs
  it in plain Node): `tests/unit/modules/moduleHostContract.test.ts`.
- Effects and timers only in the renderer kernel (`shared/hooks`, `app/providers`,
  `shared/engine`, and `shared/lib/timers.ts` for a wait outside a component). A feature hook
  composes the kernel's hooks. `npm run lint` (`eslint.kernel.mjs`, cases in
  `tests/unit/lintRules.test.ts`).
- `string | null`, not optional properties, in `src/shared` and `features/` (React props and
  `moduleHost.ts` exempt): `npm run lint` (`eslint.style.mjs`).
- No default exports outside config files: `npm run lint` (`eslint.style.mjs`).
- A Zustand store lives only in a feature's `store.ts` (or `app/`): `npm run lint`
  (`eslint.style.mjs`).
- No magic numbers in `src/main` and `features/`: `npm run lint` (`eslint.style.mjs`).
- `ipcMain.handle` only inside `handle()`, and channel types only from `src/shared/channels.ts`:
  `npm run lint` and `npm run typecheck`.
- No em dash (U+2014) outside the vendored engine files: `npm run lint` and
  `tests/unit/noEmDash.test.ts`.
- The engine's upstream name appears only in the README (its credit line):
  `tests/unit/engineName.test.ts`, which runs only where the engine is installed (not in CI).
- No `TODO`, `FIXME`, `HACK` or "for now" in comments in `src/` and `tests/`: `npm run lint`.
- Formatting (single quotes, no semicolons, 100 columns, no trailing commas): `npm run format:check`.
- Semantic color tokens, never raw Tailwind palette classes: `tests/unit/designTokens.test.ts`.
- Feature-map names match the app's copy: `tests/unit/featureMap.test.ts`.
- A backticked file path in docs, skills or comments names a file that exists, and a backticked
  `fn()` in markdown names a function the code still has: `tests/unit/docReferences.test.ts`.
- Every key in `shared/lib/i18n.ts` is used in `src/`; a key built at runtime belongs to a family
  declared in the test: `tests/unit/i18nKeys.test.ts`.
- `docs/state/` holds the small state machines' charts, drawn from their code; a machine change
  regenerates them (`UPDATE_STATE_CHARTS=1 npx vitest run tests/unit/stateCharts.test.ts`):
  `tests/unit/stateCharts.test.ts`.

## Rules that need judgment

- **The engine is stock and never patched.** Talyx is a client of its gateway; bot-to-bot
  delivery, group rooms and routines run in the engine. A gap becomes a Talyx-owned engine plugin
  (`resources/engine-plugin/`), MCP tool or skill, never an engine change.
- **Never write the engine's upstream name.** It is "the engine" (`shared/engine/`,
  `infrastructure/engine/`, `EngineStatus`, `talyx-engine`); its CLI, paths and data keys are
  written as `talyx`. Wire strings that need the name come from `engineWire()` in
  `src/shared/engine.ts`, never a literal. The test above only sees the working tree, so commits,
  PR text and issues are on you.
- **Vendored engine files** (`eslint.vendored.mjs`) keep upstream's code as written, so re-syncs
  stay clean diffs (README → Engine → Re-syncing the vendored client).
- **One feature shape.** A feature exports `xActions(backend)`: use cases over an injected
  backend, with the store behind them. Example: `features/chat/chat.ts` (`chatActions`), its
  backend `app/engine/chat.ts`, wired in `app/providers/useChatBackend.ts`. New state goes under
  a feature's actions, not in a bare store.
- **Comments explain why.** A comment that states a rule ("never X") is a lint rule waiting to be
  written: write the check instead.
- **Tests drive use cases**, never the transport (IPC, websocket) or the DOM.
- **Use the feature map's names** (the words the app shows) in prompts and PR text.
- **Corrections become checks.** When an agent is corrected, the fix is a lint rule, a type or a
  test in the same PR (or a line in #184 to #188), not a new line here.
- **Screens carry evidence.** A PR that touches a screen carries `control-talyx` evidence (a
  screenshot and the stored side effect): the `talyx-ui-change` skill.
- **Finish in the PR.** What a review finds in the PR's own change is fixed in that PR, not left
  for a follow-up PR or issue; deferring anything needs the owner's yes first.
- **Every PR gets one human read before it merges.** Unattended runs (overnight, autopilot, cloud
  agents) may open PRs; nothing auto-merges.

## Code Style

- `unknown` with type guards.
- React components: inside, stores first, then local state, named hooks, handlers
  (`async (): Promise<void>`), JSX.
- Zustand stores declare state and actions in one interface and include `reset`.
- A new IPC channel (`namespace:action`) is one row in `src/shared/channels.ts` (input from the
  zod schema main validates with, output declared once; events in `EventChannels`), a `handle()`
  in main, a line in `buildApi` and a wrapper in `src/renderer/src/shared/api/ipc.ts`.
- Copy is English only, in `shared/lib/i18n.ts` via `useLanguage((s) => s.t)`; another language
  is one more table there.
- Toasts with sonner (`toast.success`, `toast.error`); conditional classes with `cn()`. An IPC
  call's catch shows `toast.error(err instanceof Error ? err.message : '<specific message>')`.

## Naming Conventions

Components `PascalCase.tsx`, hooks `useCamelCase.ts`, services and classes `PascalCase.ts`, IPC
handlers `kebab-case.ipc.ts`, utilities `camelCase.ts`, IPC channels `namespace:action`
(`settings:get`, `theme:set-native`), branches `type/kebab-case` (`feat/roster`).

## Git and Tests

- Commits: `type: imperative description` (`feat`, `fix`, `docs`, `refactor`, `chore`, `ci`,
  `test`), under 72 characters, no period, `(#123)` for PRs.
- Tests: Vitest in `tests/unit/*.test.ts`, nested `describe`, names "should [expected behavior]",
  factory functions for test data. `tests/smoke/` is the opt-in real-engine smoke test; run it
  before merging an engine bump.

## Key Decisions

- One app, one purpose: tally agents, chat with them, configure them.
- Settings are a JSON file (`settings.json` in userData). No local database.
- Old features are deleted, not kept dormant; git history and `legacy/file-organizer` keep them.
- Builds for macOS (Developer ID signed, notarized) and Linux (unsigned). Updates download and
  restart only on the user's click, and only through an update feed Talyx signed
  (`docs/releasing.md`).
- Free and open source (AGPL-3.0-only after 1.0.5; MIT up to 1.0.5). Outside contributions need the
  contributor agreement (`CLA.md`), so paid modules can ship beside the open code. The Talyx name
  and logo and the website's text and images are not under the licence (README, License). No
  account, no server, no telemetry.
- Website (`website/`) on Vercel: it describes 1.0 and runs cookieless PostHog page analytics
  and Vercel Speed Insights (the app itself stays no-telemetry). Releases: GitHub Releases on
  `PetarStoev02/talyx-app` (the Release workflow creates a draft).
