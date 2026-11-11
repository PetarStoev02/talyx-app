# CLAUDE.md: Talyx Project Guidelines

> This file is automatically loaded by AI assistants working on this codebase.
> Keep it accurate and up to date.

## Project Overview

**Talyx** is a desktop app to tally your AI agents: a roster of bots on the left, one chat on
the right, and a manager bot (called Talyx) that delegates to the other bots and briefs you.
The bots run on **the engine**, a separate agent backend the user installs; Talyx is a client
of it and holds no orchestration logic of its own.

Talyx 1.0 is that app; the file organizer it used to be is gone. It attaches to the engine: a roster of bots in
the sidebar (pins, folders, unread and activity marks, each bot an isometric block avatar), the Agents page with the selected bot's
chat (transcript, clarify and approval cards, a composer with model, reasoning, images and
dictation), the details panel from the name pill (title, description, model, routines, look, SOUL),
the create-bot dialog from the roster's `+`, group rooms hosted by the engine (history, send, who
is answering, approvals, create, pin, delete), "Talyx needs its engine" when the engine is
missing, a first-run setup (install the engine, a provider, a first bot), a footer update button
(Talyx releases and engine updates), and Settings (providers: API keys, account sign-ins and
custom endpoints, Talyx's default model; the engine: where it is, check again, choose its file, a
debug console that sends "ping" and prints raw session events; launch at login; appearance).

- **Version:** 1.0.5
- **Stack:** Electron 44 + React 19 + TypeScript 5.9 + TailwindCSS 4
- **State:** Zustand | **UI:** shadcn/ui (New York) | **Settings:** JSON file
- **Build:** electron-vite + electron-builder | **Tests:** Vitest

### History and plans

- Design (decisions 1–20): `docs/superpowers/specs/2026-11-04-talyx-agents-pivot-design.md`.
- Plan (twelve PRs): `docs/superpowers/specs/2026-11-04-talyx-pivot-plan.html`.
- `docs/superpowers/` is gitignored: specs and plans are local working notes, not in the repo.
- The pivot was built as a stack of PRs on a `pivot` branch, squash-merged into `main` at 1.0.
  Work now lands as PRs against `main`. The plan's PR 11 (website) and PR 12 (remote machines)
  are still to come.
- The file organizer (0.11.0) is preserved on branch `legacy/file-organizer` and tag
  `v0.11.0-legacy`. Never modify them.
- The engine's upstream project is named in one place only: the small credit line at the end of the README, which
  credits it. Everywhere else (code, other docs, specs, commits, PR text) it is never named. It
  is "the engine" (`shared/engine/`, `infrastructure/engine/`, `EngineStatus`, `talyx-engine`); its CLI, paths and data keys are written as `talyx`.
  Strings the engine's wire protocol needs with the name in them (socket subprotocols, the
  ticket header, the `ui_meta` bot keys) are built at runtime by `engineWire()` in
  `src/shared/engine.ts` from the first word of `talyx-engine --version`. Never write them as
  literals; tests use a fake name. `tests/unit/engineName.test.ts` fails on any hit.

## Commands

```bash
npm run dev              # Start dev mode (Electron + Vite HMR)
npm test                 # Run unit tests (Vitest)
npm run test:smoke       # Real-engine smoke test (opt-in: TALYX_SMOKE_INSTALL_FILE=engine-install.json)
npm run test:watch       # Tests in watch mode
npm run lint             # ESLint on src/ and tests/
npm run typecheck        # TypeScript check (node + web)
npm run format           # Prettier format all files
npm run build            # Typecheck + production build
npm run build:mac        # Build macOS DMG (ARM64 + x64)
npm run build:linux      # Build Linux AppImage + deb (x64)
npm run release          # Signed, notarized DMGs, then a draft GitHub release
npm run reset            # Delete local app data (settings.json)
```

### Builds

Talyx 1.0 ships for macOS and Linux (no Windows build yet). The macOS releases are signed with
Developer ID, run with the hardened runtime (`build/entitlements.mac.plist` lists and justifies
each exception) and are notarized: the .app and the DMG are both stapled, so Gatekeeper opens them
with no warning. Linux builds are not signed. Talyx updates itself on macOS and in the AppImage with
electron-updater (GitHub provider, `publish` in `electron-builder.yml`). The release check runs
15 seconds after start, hourly, on wake and on window focus (at most every 15 minutes), one at a
time; Settings → About has Check for updates. It reads the version from the latest release's
`latest-mac.yml` / `latest-linux.yml` (CDN, no API rate limit) and calls the GitHub API only for a
newer release. The update button then offers the release with Download and Later: nothing
downloads until the click, then it offers Restart to update, and quitting installs it. It never
downloads or restarts unasked. The download is checked three ways: the feed must carry Talyx's
Ed25519 signature (`latest-*.yml.sig`, made by `scripts/sign-feed.mjs`, checked against
`UPDATE_FEED_KEY` in `updater/feedSignature.ts`), each file must match its sha512 in that feed, and
on macOS Squirrel.Mac requires the same code signature. So a release someone else publishes on
the repository cannot update an installed Talyx. A deb, or a release without the signed feed,
gets the release page and no in-app download.

Electron 44 needs macOS 13 or newer; every macOS version Talyx runs on requires a Developer ID
app to be notarized, so a release is never shipped signed but not notarized.

`npm run build:mac` needs no credentials: with no Developer ID available it builds unsigned DMGs
(the fuses' ad-hoc signature keeps them runnable on Apple Silicon) for local testing only. Both
release paths pass `forceCodeSigning`, notarize and staple the DMGs, and check them with
`verify_mac_release` (`codesign --verify --deep --strict`, `spctl -a -vv`, `xcrun stapler validate`).

Releases come from the Release workflow (`.github/workflows/release.yml`, Actions → Release → Run
workflow): macOS DMGs, Linux AppImage + deb, the real-engine smoke test on Linux, then a draft
release `v<version>` with the update feed (`latest-*.yml`, the mac zips and their blockmaps),
their signatures (`latest-*.yml.sig`), `engine-install.json` and `SHA256SUMS` (for checking a
download by hand). Drafts are invisible to installed apps until published. Its body is the optional
`highlights` input under `## Highlights`, then `docs/release-notes/<version>.md` (write it before
releasing; no engine name), then GitHub's generated notes. It needs the secret
`ENGINE_INSTALL_JSON` (base64 of `engine-install.json`), set once per file change with
`gh secret set ENGINE_INSTALL_JSON < <(base64 -i engine-install.json)`; each job checks it with
`scripts/release-lib.sh`, which `release.sh` shares. The mac job also needs the five signing
secrets and `UPDATE_SIGNING_KEY` below and fails before the build when one is missing.

`npm run release` (`scripts/release.sh`) is the local path, macOS DMGs only. Before it, write the
gitignored `release-highlights.md` at the repo root: 1-3 lines `- **Lead.** Text.`. The script puts
them under `## Highlights`, then `docs/release-notes/<version>.md`, then GitHub's generated
notes, the same body as the workflow; the update button shows the highlights. Without the file
the script warns and the release has no highlights.

`npm run release` needs `engine-install.json` (the engine install steps the app fetches from the
release) at the repo root. It is gitignored, and its SHA-256 must equal `ENGINE_INSTALL_SHA256` in
`src/main/infrastructure/setup/installPin.ts`; the script also requires the file's `engineVersion` to equal
`EXPECTED_ENGINE_VERSION` and exactly one commit hash in it, and refuses to release otherwise. Changing
the commands means updating that pin in the same commit. It also needs the five signing
variables and `UPDATE_SIGNING_KEY` below in the environment and refuses without them.

#### Signing secrets

The account owner creates these once; never commit them or paste them anywhere else. Set each
as an Actions secret on `PetarStoev02/talyx-app`:

- `CSC_LINK`: the Developer ID Application certificate as base64 of a `.p12`. In Xcode →
  Settings → Accounts → Manage Certificates, add a Developer ID Application certificate (or create
  it at developer.apple.com → Certificates). In Keychain Access, export the certificate with its
  private key as a `.p12`. Then `gh secret set CSC_LINK < <(base64 -i DeveloperID.p12)`.
- `CSC_KEY_PASSWORD`: the password chosen for that `.p12` export. `gh secret set CSC_KEY_PASSWORD`.
- `APPLE_ID`: the Apple Account email of the developer account. `gh secret set APPLE_ID`.
- `APPLE_APP_SPECIFIC_PASSWORD`: an app-specific password for that account, from
  account.apple.com → Sign-In and Security → App-Specific Passwords (shown only once).
  `gh secret set APPLE_APP_SPECIFIC_PASSWORD`. Check it first with
  `xcrun notarytool history --apple-id <email> --team-id <team> --password <password>`.
- `APPLE_TEAM_ID`: the team ID in the Developer ID certificate's name (`3Z52YUB6CN`).
  `gh secret set APPLE_TEAM_ID`.

- `UPDATE_SIGNING_KEY`: base64 of the Ed25519 private key that signs the update feed. The key
  lives outside git in `~/.config/talyx/keys/update.private.pem`; back it up to 1Password.
  `gh secret set UPDATE_SIGNING_KEY < <(base64 -i ~/.config/talyx/keys/update.private.pem)`; for
  `npm run release`, `export UPDATE_SIGNING_KEY=$(base64 -i ~/.config/talyx/keys/update.private.pem)`.
  Its public half is `UPDATE_FEED_KEY`. Every installed Talyx refuses a feed signed with another
  key, so a lost key means users update once by hand from the release page, to a build that
  ships the new public key.

The certificate expires after five years and the membership yearly; renew both before a release.

During `npm run dev` the renderer is also usable in a plain browser at
`http://localhost:5173` (dev bridge → real main process).

## Architecture

### Main Process (Electron Backend)

```
src/main/
├── index.ts                    # Entry point: splash, main window, IPC, release check
├── lib/electronUtils.ts        # is.dev, window shortcuts
├── lib/appMenu.ts              # the packaged app's menu (no dev tools)
└── infrastructure/
    ├── bridge/DevBridge.ts     # Dev-only HTTP+SSE bridge for the browser renderer
    ├── engine/                 # engine.ts (Engine: CLI, attach, tickets, REST),
    │                           # gateway.ts (vendored attach + ticket mint), engineSockets.ts
    ├── ipc/                    # settings.ipc.ts, engine.ipc.ts, setup.ipc.ts (the engine install),
    │                           # updater.ipc.ts (update download and open), validation.ts (zod at the boundary),
    │                           # modules.ipc.ts (modules: license, install, talyx-module:// files)
    ├── modules/                # signing.ts (license keys and signed module bundles, Ed25519),
    │                           # catalog.ts (the published module list), moduleHost.ts (install, load, run),
    │                           # activationLink.ts (talyx://activate links)
    ├── security/               # webContentsGuard (no new windows, no navigation away),
    │                           # appProtocol.ts (serves the packaged renderer over app://)
    ├── setup/                  # installPin.ts (the hash pin), installSteps.ts (loads the install file), installRunner.ts (runs it)
    ├── storage/SettingsStore.ts # settings.json in userData
    ├── system/loginItem.ts     # launch at login: macOS login item, Linux autostart .desktop
    └── updater/                # releaseCheck.ts (GitHub latest-release check), releaseChecks.ts
                                # (one check at a time, the staleness limits), selfUpdate.ts
                                # (electron-updater: download on click, restart to update),
                                # feedSignature.ts (the update feed must be signed by Talyx),
                                # updateState.ts (the update state machine)
```

`src/shared/api.ts` is the single definition of `window.api`; the preload builds it over
`ipcRenderer`, the browser dev bridge over HTTP.

`infrastructure/engine/` runs the engine CLI (`talyx-engine`: the `enginePath` setting, then
PATH, then `~/.local/bin`), attaches with `gateway ensure --json` and mints one-use tickets
through the profile's control socket. Main opens the gateway websocket itself (the gateway
admits no Origin header and takes the ticket in a subprotocol) and relays frames over
`engine:socket-*` IPC; REST goes through `engine:http`. Main never owns or kills the gateway.

### Renderer Process (React Frontend: Feature-Sliced Design)

```
src/renderer/src/
├── app/              # Global state, browser dev bridge, the hooks that wire `host` into
│                     # features (useRosterBackend, useChatBackend, useProvidersBackend)
├── pages/            # AgentsPage (the selected bot's chat or room, and details), SettingsPage
├── widgets/          # AppShell, Roster (sidebar bots and rooms, create dialogs), Chat (transcript,
│                     # cards, composer, RoomPane), BotDetails (the details panel and routines),
│                     # Providers (the settings sections, add-provider dialog, sign-in),
│                     # settings-engine (Settings: the engine's state and path, the debug console),
│                     # settings-startup (Settings: launch at login),
│                     # Setup (the first-run flow: welcome, engine, provider, bot steps)
├── features/         # bots (roster data, folders, pins, unread, details, routines, create, rooms),
│                     # chat (transcript, use cases, hosted rooms polled over `groups.*`),
│                     # providers (keys, endpoints and sign-ins over REST; writes go to every bot),
│                     # setup (which step comes first, the engine install and its screens),
│                     # modules (license state, module pages; nothing shows without a key)
└── shared/           # Reusable: ui/ (shadcn), hooks/, api/ (IPC wrappers), lib/,
                      # engine/ (vendored engine client; host.ts is the facade features use)
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
import { useNavigation } from '@app/providers/useNavigation'
import { AppShell } from '@widgets/app-shell'
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
- No em dash (U+2014) in any file outside the vendored engine files: use a comma, colon, period or
  parentheses. `tests/unit/noEmDash.test.ts` and `npm run lint` enforce it.

### TypeScript

- **Strict mode** enabled
- Never use `any`; prefer `unknown` with type guards
- Always type IPC return values explicitly
- Use `string | null` not optional for nullable values
- Exception: the vendored engine files (listed in `eslint.vendored.mjs`) keep upstream's code as
  written so re-syncs stay clean diffs; see README → Engine → Re-syncing the vendored client

### React Components

```typescript
// Named exports, explicit return type
export function AgentsPage(): React.JSX.Element {
  // 1. Zustand stores
  const t = useLanguage((s) => s.t)
  // 2. Local state
  // 3. Effects
  // 4. Handlers (async functions with explicit Promise<void>)
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

**Channels:** `namespace:action` (e.g., `settings:get`, `settings:set`, `theme:set-native`)

**Handler registration** (validate input with zod at the boundary):

```typescript
export function registerSettingsIpc(): void {
  ipcMain.handle('settings:set', (_event, rawPartial: unknown) => {
    settingsStore.set(validateInput(UserSettingsPartialSchema, rawPartial))
    return settingsStore.store
  })
}
```

**API surface:** add the call to `buildApi` in `src/shared/api.ts`, then a typed wrapper in
`src/renderer/src/shared/api/ipc.ts`:

```typescript
export const settingsApi = {
  get: (): Promise<AppSettings> => window.api.getSettings() as Promise<AppSettings>
}
```

### Copy

English only for now (`shared/lib/i18n.ts`, via `useLanguage((s) => s.t)`). Another language is
one more table in that file.

## Naming Conventions

| Thing            | Convention          | Example                                                             |
| ---------------- | ------------------- | ------------------------------------------------------------------- |
| React components | `PascalCase.tsx`    | `AgentsPage.tsx`, `AppShell.tsx`                                    |
| Hooks            | `useCamelCase.ts`   | `useTheme.ts`, `useNavigation.ts`                                   |
| Services/Classes | `PascalCase.ts`     | `SettingsStore.ts`, `DevBridge.ts`                                  |
| IPC handlers     | `kebab-case.ipc.ts` | `settings.ipc.ts`                                                   |
| Utilities        | `camelCase.ts`      | `utils.ts`                                                          |
| IPC channels     | `namespace:action`  | `settings:get`, `settings:set`, `theme:set-native`, `updater:state` |
| Branches         | `type/kebab-case`   | `feat/roster`                                                       |

## Git Conventions

**Commit format:** `type: imperative description`

Types: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `ci:`, `test:`

- Keep subject under 72 characters, no period at end
- Use imperative mood ("add" not "added")
- Reference PRs with `(#123)`

## Testing

**Framework:** Vitest | **Location:** `tests/unit/` | **Pattern:** `*.test.ts`

- Group with nested `describe` blocks
- Name tests: "should [expected behavior]"
- Test success path + edge cases
- Drive behavior through use cases, not the transport (IPC, websocket) or the DOM
- Use factory functions for test data
- `tests/smoke/` holds the opt-in real-engine smoke test; run it before merging an engine bump

## Key Patterns

**Toast notifications:** `toast.success('Done')` / `toast.error('Failed')` (via sonner)

**Conditional classes:** `cn('base', condition && 'active')` (clsx + tailwind-merge)

**Error handling in IPC calls:**

```typescript
try {
  await settingsApi.set({ theme })
} catch (err) {
  toast.error(err instanceof Error ? err.message : 'Operation failed')
}
```

## Key Decisions

- One app, one purpose: tally agents, chat with them, configure them.
- The engine is stock and never patched; Talyx is a client of its gateway. Bot-to-bot
  delivery, group rooms and routines run in the engine, not in the app.
- Settings are a JSON file (`settings.json` in userData). No local database.
- Old features are deleted, not kept dormant; git history and `legacy/file-organizer` keep them.
- Builds for macOS (Developer ID signed, notarized) and Linux (unsigned). Automatic updates on
  macOS and the AppImage (electron-updater; download and restart only on the user's click, else
  install on quit; only through an update feed Talyx signed); the
  deb updates from the release page.
- Free and open source (MIT). No account, no server, no telemetry.
- Website (`website/`) on Vercel: it describes 1.0 and runs cookieless PostHog page analytics
  and Vercel Speed Insights (the app itself stays no-telemetry). Releases: GitHub Releases on `PetarStoev02/talyx-app`
  (the Release workflow creates a draft).
