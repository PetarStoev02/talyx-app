# CLAUDE.md — Talyx Project Guidelines

> This file is automatically loaded by AI assistants working on this codebase.
> Keep it accurate and up to date.

## Project Overview

**Talyx Office** — the owner's personal macOS build (see `docs/superpowers/specs/2026-10-31-talyx-office-design.md`).
An Electron app that shows the owner's Grok Bots and T3 Code work as a 3D office: each bot is a
character, rooms are group chats, where a bot stands is its status. The owner can hand a bot a
task from the office. No model runs inside Talyx; the old file organizer, assistant and MCP server
are gone.

- **Version:** 0.11.0
- **Stack:** Electron 44 + React 19 + TypeScript 5.9 + TailwindCSS 4 + three.js
- **State:** Zustand | **DB:** better-sqlite3 (`office.db`) | **Build:** electron-vite + electron-builder | **Tests:** Vitest
- **Inbound:** HTTP server on `127.0.0.1:47321` (`POST /events` Grok bots, `POST /t3/events` T3, `GET /health`),
  Bearer token, published to the internet with Tailscale Funnel (the tailnet admin must enable Funnel first).
- **T3 Code:** read via `~/.t3/bin/t3 thread list|show --json`; project names read-only from
  `~/.t3/userdata/statev2.sqlite`; started/sent via `t3 thread start|send`.
- **Tasks out:** Grok routine webhooks (https only), keys in Electron `safeStorage` (`userData/secrets`).
- The AgroOps roster is seeded on first start. Closing the window keeps Talyx running in the menu bar.

## Commands

```bash
env -u ELECTRON_RUN_AS_NODE npm run dev   # Dev mode (the shell may set ELECTRON_RUN_AS_NODE)
npm test                 # Unit tests (Vitest)
npm run lint             # ESLint on src/ and tests/
npm run typecheck        # TypeScript check (node + web)
npm run format           # Prettier
npm run build            # Typecheck + production build
npm run build:mac        # macOS DMG (ad-hoc signed, not notarized)
npm run reset            # Delete office.db, settings, secrets, logos (npm run dev:reset also starts dev)
```

During `npm run dev` the renderer is also usable at `http://localhost:5173` (dev bridge → real main process).

## Architecture

### Main Process

```
src/main/
├── index.ts                    # Entry — window, tray, single instance, starts the office
├── domain/office/              # Business logic (no framework deps)
│   ├── model.ts, errors.ts, parseEvents.ts, placeBot.ts, layoutRooms.ts, seedAgroOps.ts, botInstructions.ts
│   ├── repository/             # RosterRepo, SignalRepo (SQLite)
│   ├── services/               # T3Watcher (polls T3 threads, emits signals)
│   └── useCases/               # one class per action: RecordSignal, GetOfficeSnapshot, GiveTask,
│                               # SendToThread, CreateProject, SaveGroup, DeleteBot, SetWebhookKey,
│                               # GetBotInstructions, SetFunnel
└── infrastructure/
    ├── office/                 # startOffice (wiring), InboundServer, FunnelControl (tailscale), T3Cli,
    │                           # T3Projects, WebhookClient, SecretStore, inboundToken, LogoStore
    ├── ipc/                    # office.ipc, roster.ipc, settings.ipc, validation
    ├── tray/, bridge/, security/, database/, storage/ (SettingsStore, JSON file)
```

Shared types for main, preload and renderer live in `src/shared/` (`office.ts`, `api.ts`).

### Renderer Process (React — Feature-Sliced Design)

```
src/renderer/src/
├── app/              # Zustand stores (useOffice, useNavigation), browser bridge
├── pages/            # office/ (scene + panels), office-settings/ (bots, keys, Funnel, instructions)
├── widgets/          # office-scene/ (three.js), office-hud/ (TopBar, OfficeMap), roster-panel/, event-feed/
├── features/         # bot-card/ (card + give-task form)
└── shared/           # ui/ (shadcn primitives), lib/
```

**FSD Layer Rules** (strict top-down dependency):

- `app/` → can import from any layer
- `pages/` → `widgets/`, `features/`, `shared/`
- `widgets/` → `features/`, `shared/`
- `features/` → `shared/`
- `shared/` → no upward imports

### Import Aliases

Always use aliases for cross-layer imports, never relative paths across layers:

```typescript
import { Button } from '@shared/ui/button'
import { useOffice } from '@app/providers/useOffice'
import { BotCard } from '@features/bot-card/BotCard'
```

| Alias         | Path                          |
| ------------- | ----------------------------- |
| `@renderer/*` | `src/renderer/src/*`          |
| `@/*`         | `src/renderer/src/*`          |
| `@app/*`      | `src/renderer/src/app/*`      |
| `@pages/*`    | `src/renderer/src/pages/*`    |
| `@widgets/*`  | `src/renderer/src/widgets/*`  |
| `@features/*` | `src/renderer/src/features/*` |
| `@shared/*`   | `src/renderer/src/shared/*`   |

## Code Style

### Formatting (Prettier)

- Single quotes, no semicolons, 100 char print width, no trailing commas
- 2-space indentation, LF line endings

### TypeScript

- **Strict mode** enabled
- Never use `any` — prefer `unknown` with type guards
- Always type IPC return values explicitly
- Use `string | null` not optional for nullable values

### React Components

```typescript
// Named exports, explicit return type
export function OfficePage(): React.JSX.Element {
  // 1. Zustand stores
  const { snapshot, refresh } = useOffice()
  // 2. Local state
  const [loading, setLoading] = useState(false)
  // 3. Effects
  useEffect(() => { /* ... */ }, [])
  // 4. Handlers (async functions with explicit Promise<void>)
  async function handleRefresh(): Promise<void> {
    setLoading(true)
    await refresh()
    setLoading(false)
  }
  // 5. JSX
  return <div>...</div>
}
```

### Zustand Stores

```typescript
interface StoreState {
  value: string | null // State
  setValue: (v: string) => void // Actions
  reset: () => void
}

export const useStore = create<StoreState>((set) => ({
  value: null,
  setValue: (v) => set({ value: v }),
  reset: () => set({ value: null })
}))
```

### IPC Patterns

**Channels:** `namespace:action` (e.g., `office:snapshot`, `office:give-task`, `roster:funnel`)

**Handler registration:**

```typescript
export function registerOfficeIpc(getSnapshot: GetOfficeSnapshot, ...deps): void {
  ipcMain.handle('office:snapshot', async (_event, projectId: string | null) => {
    return getSnapshot.execute(projectId)
  })
}
```

**Renderer API:** the whole `window.api` surface is defined once in `src/shared/api.ts`
(`buildApi(transport)`); the preload and the browser dev bridge both use it. Components call it directly:

```typescript
set({ snapshot: await window.api.officeSnapshot(projectId) })
```

### Domain Services

- Services are classes with dependency injection via constructor
- Repositories handle SQLite access (end with `Repo`)
- Use `Result<T, E>` pattern for expected failures (not exceptions)

## Naming Conventions

| Thing            | Convention          | Example                                                                |
| ---------------- | ------------------- | ---------------------------------------------------------------------- |
| React components | `PascalCase.tsx`    | `OfficePage.tsx`, `BotCard.tsx`                                        |
| Hooks            | `useCamelCase.ts`   | `useOffice.ts`, `useNavigation.ts`                                     |
| Services/Classes | `PascalCase.ts`     | `T3Watcher.ts`, `InboundServer.ts`                                     |
| Repositories     | `PascalCaseRepo.ts` | `RosterRepo.ts`                                                        |
| IPC handlers     | `kebab-case.ipc.ts` | `office.ipc.ts`, `roster.ipc.ts`                                       |
| Utilities        | `camelCase.ts`      | `utils.ts`                                                             |
| IPC channels     | `namespace:action`  | `office:snapshot`, `office:give-task`, `roster:funnel`, `settings:get` |
| Branches         | `type/kebab-case`   | `feat/keyboard-shortcuts`                                              |

## Git Conventions

**Commit format:** `type: imperative description`

Types: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `ci:`, `test:`

```
feat: add office map to the top bar
fix: mark silent bots as stale
test: unit tests for the T3 watcher
```

- Keep subject under 72 characters, no period at end
- Use imperative mood ("add" not "added")
- Reference PRs with `(#123)`

## Testing

**Framework:** Vitest | **Location:** `tests/unit/` | **Pattern:** `*.test.ts`

```typescript
import { describe, it, expect } from 'vitest'

describe('parseBotEvent', () => {
  it('should reject an event from an unknown bot', () => {
    expect(() => parseBotEvent(payload, [], now)).toThrow(UnknownBotError)
  })
})
```

- Group with nested `describe` blocks
- Name tests: "should [expected behavior]"
- Test success path + edge cases
- Use factory functions for test data

## Key Patterns

**Toast notifications:** `toast.success('Done')` / `toast.error('Failed')` (via sonner)

**Conditional classes:** `cn('base', condition && 'active')` (clsx + tailwind-merge)

**Error handling in IPC calls:**

```typescript
try {
  const snapshot = await window.api.officeSnapshot(projectId)
} catch (err) {
  toast.error(err instanceof Error ? err.message : 'Operation failed')
}
```

## Key Decisions

- Personal build: built for this Mac, Tailscale, T3 Code install and Grok Bots. No migration, no onboarding.
- Grok Bots have no read API: Talyx shows what bots report to `POST /events`, never reads Grok chats.
- Secrets (webhook keys, inbound token) never reach the renderer, logs or git; the endpoint is
  reachable only through Funnel, with the Bearer token.
- Staleness is shown, not hidden: a bot not heard from is marked stale rather than working.
- Releases are ad-hoc signed, not notarized, no in-app update. `website/` and `scripts/release.sh` are
  left as they were; a public release is a later decision.
