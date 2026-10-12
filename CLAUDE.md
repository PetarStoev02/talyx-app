# CLAUDE.md — Talyx Project Guidelines

> This file is automatically loaded by AI assistants working on this codebase.
> Keep it accurate and up to date.

## Project Overview

**Talyx** — AI-powered desktop file organizer. macOS only as of 0.9.0 (see Builds below). Talyx is a personal harness: a hotkey overlay where the user's own Claude — an API key, or their signed-in Claude Code on a subscription — operates the computer through typed abilities with an approval gate; file sorting is one ability. Sorting uses `sorterSource` in Settings: **Smart Local** (extension + metadata, default, nothing leaves the machine) or **Your Claude** (the same account the assistant uses — the whole preview batch when Claude is reachable). Talyx does not host classification weights. Additionally exposes an MCP server so any AI assistant can operate Talyx remotely.

- **Version:** 0.11.0
- **Stack:** Electron 44 + React 19 + TypeScript 5.9 + TailwindCSS 4
- **State:** Zustand | **UI:** shadcn/ui (New York) | **DB:** better-sqlite3
- **Build:** electron-vite + electron-builder | **Tests:** Vitest
- **AI:** `@anthropic-ai/sdk` (assistant + Claude sorting, user's API key) | `@anthropic-ai/claude-agent-sdk` (assistant + Claude sorting, user's installed Claude Code) | local ONNX (voice: whisper / Kokoro only — not used for sorting)
- **MCP:** `@modelcontextprotocol/sdk` (stdio transport)

## Commands

```bash
npm run dev              # Start dev mode (Electron + Vite HMR)
npm test                 # Run unit tests (Vitest)
npm run test:watch       # Tests in watch mode
npm run lint             # ESLint on src/ and tests/
npm run typecheck        # TypeScript check (node + web)
npm run format           # Prettier format all files
npm run build            # Typecheck + production build
npm run build:mac        # Build macOS DMG (ARM64 + x64)
npm run release          # Ad-hoc signed DMGs (no Apple account), then a draft GitHub release
```

### Builds

Talyx is macOS only: there is no Windows or Linux build.

Releases are ad-hoc signed, not notarized (no Apple account), and there is no in-app update, so
macOS blocks every downloaded version the first time it is opened. Users try to open Talyx,
dismiss the warning, then click Open Anyway in System Settings → Privacy & Security (it asks for
the Mac password), or run `xattr -dr com.apple.quarantine /Applications/Talyx.app` once. After
installing a new version, Automation and Files & Folders prompts appear again; for Accessibility
and Screen Recording the old Talyx entry stays on but stops working: remove it with "−" and add
Talyx again. Talyx is not hardened or notarized, so software already running as you could inject
code into it; grant permissions accordingly.

Voice needs Apple Silicon. `onnxruntime-node` publishes no `darwin/x64` binary,
so whisper and Kokoro cannot load on Intel Macs; sorting
and the assistant are unaffected.

Electron 44 needs macOS 13 or newer.

During `npm run dev` the renderer is also usable in a plain browser at
`http://localhost:5173` (dev bridge → real main process). Use the folder
picker — drag-and-drop of OS files has no absolute paths in a browser.

## Architecture

### Main Process (Electron Backend)

```
src/main/
├── index.ts                    # Entry point — wires services, creates window
├── mcp/                        # MCP server (standalone process, stdio transport)
│   ├── server.ts               # Entry point — compiled to out/main/mcp/server.js
│   ├── types.ts                # McpServices interface, FileEntry type
│   └── tools/                  # 9 MCP tools (scan, classify, sort, undo, search, etc.)
├── domain/                     # Business logic (no framework deps)
│   ├── classification/         # AI + Smart Local pipeline
│   │   ├── services/           # ExtensionClassifier, MetadataClassifier, ClassificationPipeline,
│   │   │                       # TextExtractor, Sorter (SmartLocalSorter/ClaudeSorter/
│   │   │                       # ClaudeSorter — resolved from sorterSource), redactForClassification
│   │   ├── model/              # Category
│   │   └── repository/         # ClassificationCacheRepo (SQLite)
│   ├── sorting/
│   │   ├── services/           # SortExecutor, UndoService, RenameEngine
│   │   └── repository/         # SortHistoryRepo (SQLite)
│   ├── watching/
│   │   ├── services/           # WatchService (chokidar)
│   │   └── repository/         # WatchFolderRepo (SQLite)
│   ├── instruction/            # Typed abilities the agent can call
│   │   ├── model/              # Capability, Effect, CapabilityRegistry, errors
│   │   └── capabilities/       # files, system, dev, desktop, everyday, mail, messages,
│   │                           # briefing, recall, triage, screen, focus, undo — 35 abilities
│   └── agent/                  # Brain seam, AgentSession (API key loop), CapabilityDispatcher,
│                               # ApprovalGate, ApprovalPolicy, BuiltinToolPolicy
└── infrastructure/
    ├── ipc/                    # IPC handlers (folder, sort, watch, settings, agent)
    ├── agent/                  # ActionLogRepo, ApiKeyStore, capabilityDeps, systemPrompt
    ├── ai-providers/           # AnthropicProvider (user's own Claude API key), ClaudeCodeProvider
    │                           # (user's installed Claude Code as a plain completer, no tools) —
    │                           # both also back Claude sorting via resolveSorter.ts
    ├── brains/                 # ClaudeCodeBrain (Agent SDK over the user's claude binary), findClaudeCode
    ├── assistant/              # AssistantWindowManager — hotkey overlay + kill switch
    ├── voice/                  # SttWorker, VoiceModelInstaller, Speaker, VoiceNarrator, wav,
    │                           # KokoroSpeaker, SpeechRouter, TtsWorker, AfplayPlayer
    ├── workers/                # stt.worker, tts.worker
    ├── database/               # SQLite init + migrations
    └── storage/                # SettingsStore (JSON file)
```

### Renderer Process (React Frontend — Feature-Sliced Design)

```
src/renderer/src/
├── app/              # Providers, global state (Zustand stores)
├── pages/            # Full pages: SortPage, WatchPage, HistoryPage, SettingsPage
├── widgets/          # Self-contained UI blocks: AppShell (sidebar + page shell), WelcomeOverlay
│                     # (steps: WelcomeStep, ConnectClaudeStep)
├── features/         # User interactions: drop-to-sort, ai-search, file-preview, feedback, assistant
└── shared/           # Reusable: ui/ (shadcn), hooks/, api/ (IPC wrappers), lib/
```

`features/assistant/` holds the hotkey overlay's chat UI (`useAgent` store, `ApprovalCard`,
`Transcript`, `InstructionInput`), shared by the overlay and the Ask page. Its own entry
point, `src/renderer/assistant/` (outside `src/renderer/src/`), is a small standalone React
app loaded via `assistant.html` — not part of the main window's FSD tree.

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
import { useSortSession } from '@app/providers/useSortSession'
import { DropZone } from '@features/drop-to-sort/DropZone'
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
export function SortPage(): React.JSX.Element {
  // 1. Zustand stores
  const { sourceFolder, setSourceFolder } = useSortSession()
  // 2. Local state
  const [loading, setLoading] = useState(false)
  // 3. Effects
  useEffect(() => { /* ... */ }, [])
  // 4. Handlers (async functions with explicit Promise<void>)
  async function handleSelectSource(): Promise<void> {
    const path = await folderApi.select()
    if (path) setSourceFolder(path)
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

**Channels:** `namespace:action` (e.g., `folder:select`, `sort:preview`, `watch:add`)

**Handler registration:**

```typescript
export function registerSortIpc(pipeline: ClassificationPipeline, ...deps): void {
  ipcMain.handle('sort:preview', async (_event, files, options) => {
    return pipeline.classifyFiles(files, options)
  })
}
```

**Renderer API wrapper:**

```typescript
export const sortApi = {
  preview: (files: FileEntry[]): Promise<ClassifiedFile[]> =>
    window.api.previewSort(files) as Promise<ClassifiedFile[]>
}
```

### Domain Services

- Services are classes with dependency injection via constructor
- Repositories handle SQLite access (end with `Repo`)
- Use `Result<T, E>` pattern for expected failures (not exceptions)

## Naming Conventions

| Thing            | Convention          | Example                                                                                                                                                                                                                     |
| ---------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React components | `PascalCase.tsx`    | `SortPage.tsx`, `DropZone.tsx`                                                                                                                                                                                              |
| Hooks            | `useCamelCase.ts`   | `useSortSession.ts`, `useTheme.ts`                                                                                                                                                                                          |
| Services/Classes | `PascalCase.ts`     | `SortExecutor.ts`, `ClassificationPipeline.ts`                                                                                                                                                                              |
| Repositories     | `PascalCaseRepo.ts` | `SortHistoryRepo.ts`                                                                                                                                                                                                        |
| IPC handlers     | `kebab-case.ipc.ts` | `folder.ipc.ts`, `sort.ipc.ts`                                                                                                                                                                                              |
| Utilities        | `camelCase.ts`      | `utils.ts`                                                                                                                                                                                                                  |
| IPC channels     | `namespace:action`  | `sort:execute`, `watch:toggle`, `agent:run`, `agent:approve`, `agent:abort`, `agent:event`, `voice:transcribe`, `voice:permission`, `voice:download-model`, `voice:tts-status`, `voice:download-tts`, `voice:preview-voice` |
| Branches         | `type/kebab-case`   | `feat/keyboard-shortcuts`                                                                                                                                                                                                   |

## Git Conventions

**Commit format:** `type: imperative description`

Types: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `ci:`, `test:`

```
feat: add keyboard shortcuts for page navigation
fix: resolve path traversal in sort executor
test: unit tests for classification pipeline
```

- Keep subject under 72 characters, no period at end
- Use imperative mood ("add" not "added")
- Reference PRs with `(#123)`

## Testing

**Framework:** Vitest | **Location:** `tests/unit/` | **Pattern:** `*.test.ts`

```typescript
import { describe, it, expect } from 'vitest'

describe('ExtensionClassifier', () => {
  const classifier = new ExtensionClassifier()

  it('should classify jpg as Images/Photos', () => {
    const result = classifier.classify('photo.jpg')
    expect(result.category).toBe('Images')
    expect(result.subcategory).toBe('Photos')
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
  const result = await sortApi.preview(files)
} catch (err) {
  toast.error(err instanceof Error ? err.message : 'Operation failed')
}
```

**Progress callbacks:**

```typescript
const batch = await executor.executeBatch(files, outputDir, mode, (progress) => {
  sender.send('sort:progress', progress)
})
```

## MCP Server

Talyx exposes an MCP server (`src/main/mcp/server.ts`) with 9 tools:

| Tool                | Purpose                                |
| ------------------- | -------------------------------------- |
| `scan_folder`       | List files with metadata               |
| `get_file_metadata` | EXIF, audio tags, extension category   |
| `extract_text`      | Text from PDF, DOCX, XLSX, etc.        |
| `classify_files`    | Accept AI classifications → sort plan  |
| `execute_sort`      | Move/copy files into organized folders |
| `undo_sort`         | Restore files to original locations    |
| `sort_history`      | View past operations                   |
| `search_files`      | Keyword search                         |
| `watch_folder`      | Manage auto-sort directories           |

The server runs as a standalone Node.js process via stdio transport. AI clients (Claude Desktop, Cursor) spawn it and call tools via JSON-RPC. The Electron app works independently with its built-in AI classification and Smart Local fallback.

## AI Classification

Sorting picks its model via `sorterSource` in `UserSettings` (`'smart-local' | 'claude'`,
default `'smart-local'`), resolved once per preview by `resolveSorter.ts`. **Smart Local**
(extension + metadata) is the default and the floor — no model, no download, no network, ever.
**Your Claude** classifies the **whole batch** when Claude is reachable (names, metadata, and
extracted text when available — first 2000 characters, with common currency amounts, dates and legally-suffixed company names masked first, best-effort (other names and places are not) — see
`redactForClassification.ts` and `ClaudeSorter.ts`). If Claude is unreachable or fails, Smart
Local remains the answer and the Sort page says so. Stored `talyx-models` settings migrate
silently to `smart-local`. Talyx does not download or run owned classification weights.
(The assistant itself is unchanged: with an API key it sends the conversation and tool results
to Anthropic; with Claude Code the user's own signed-in binary does, on their subscription.)

**Key files:**

- `src/main/infrastructure/ipc/resolveSorter.ts` — Claude when chosen and reachable, else Smart Local
- `src/main/infrastructure/ipc/escalateAndMerge.ts` — whole-batch Claude escalation
- `src/main/domain/classification/services/ClaudeSorter.ts` — Claude classification
- `src/main/domain/classification/services/Sorter.ts` — Smart Local floor
- `src/main/domain/ai/voicePresets.ts` — whisper choices (fast/accurate) + the Kokoro model and its voices

**Voice:** hold-to-talk dictation via whisper (`@huggingface/transformers` on `onnxruntime-node`)
in a worker. Spoken replies via Kokoro-82M (`StyleTextToSpeech2Model` on the same transformers and
ONNX runtime, phonemes from `phonemizer`, sentence by sentence through `afplay`), with macOS `say`
as the fallback and as the Bulgarian voice. Whisper and Kokoro models are downloaded from Hugging Face
on first use, only when voice is turned on. Voice is a separate install path from sorting — not a
Brain picker.

**AI classification features:**

- Semantic classification (with Claude): invoices go to `Documents/Invoices`, not just `Documents`
- Smart rename suggestions following Harvard file naming conventions
- Content-aware sorting when Claude reads the batch
- Language-aware renaming: Bulgarian content gets Cyrillic names, English gets English
- First run is the Welcome overlay (`widgets/welcome/`): welcome, connect your Claude (optional),
  done — no hardware detection, no classification model download

## Key Decisions

- Harness: abilities, approval, memory, notices. The user brings the brain (Claude today;
  other providers later — not Ollama for now).
- Privacy-first by default: Smart Local sorting (extension + metadata) makes zero network calls
  and is what a fresh install uses. Choosing Your Claude is the path that may send data
  off-device — the whole batch (names/metadata plus truncated text with currency amounts, dates and suffixed company names masked, when
  extracted) — and it is opt-in, never the default.
- Voice stays on-device (whisper / Kokoro); not a sorting Brain.
- MCP server: exposes tools so external AI assistants can also operate Talyx
- Free and open source (MIT). No account, nothing to buy.
- Website on Vercel. Releases: GitHub Releases on `PetarStoev02/talyx-app` (`npm run release` creates a draft). The app checks the GitHub latest-release API and opens the page — it does not install updates (unsigned). No server.
