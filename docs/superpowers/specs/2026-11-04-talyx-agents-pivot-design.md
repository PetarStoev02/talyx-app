# Talyx pivot: a place to tally agents

Date: 2026-11-04. Owner: Petar Stoev. Status: design, awaiting approval.

## Intent

Talyx stops being a file organizer and becomes the desktop app Petar uses every day to run his
AI agents: a roster of bots on the left, one chat on the right, a manager bot who talks
to the other bots and briefs him. Today he does this in a personal fork of the engine's desktop app
(the "old desktop build"). That fork carries a huge app of which he uses one view, and every upstream
merge is a burden. The pivot moves only that view into Talyx, restyled to Talyx's own design
rules, on top of a stock, unmodified engine backend.

Petar is the main user of Talyx. He will use it more after the pivot than before.

## What the user does in it

- Opens the app. Sees pinned bots as tiles at the top of the sidebar (today: T3 Tots and the
  manager bot), then folders per project (AgroOps Team, Clients) with bot rows and group-chat rows.
- Talks mostly to the manager bot. It gives instructions to the other bots (via the backend
  `message_agent` tool), they answer him, he gives Petar a brief.
- Talks directly to any bot when he wants to.
- Opens a group chat where several bots debate an idea or review what was done.
- Clicks the bot's name pill above the chat to open a details panel: Details (title,
  description, provider, model, routines with on/off switches), Look (avatar), Soul (SOUL.md).
- Creates a new bot from a small dialog.
- Later: points the app at an engine gateway on another machine over Tailscale.

## Goals

1. One app, one purpose: tally agents (sort and count), chat with them, configure them.
2. Keep every engine feature Petar relies on: profiles, sessions under the hood, bot-to-bot
   messaging, hosted group rooms with their history, routines (cron), SOUL, model choice,
   clarify/approval cards, the composer (model chip, reasoning level, mic, voice).
3. Talyx look and feel: Geist, one ground, one ink, one action, pills, tone-step surfaces.
4. Stock engine backend. Never patch it. Upstream updates come from `pip`/`uv` alone.
5. No more desktop fork. The fork of the engine's desktop app retires once Talyx covers daily use.

## Non-goals (first build)

- Signing or notarization on any platform, and auto-update. Builds for macOS, Windows and Linux
  ship unsigned (Petar's decision); the download page and release notes carry the open-anyway
  steps for each OS.
- A Tailscale/peer UI beyond a gateway URL field. Peers are registered on the engine side.
- Local model download and hardware pages (the old app's `local-models-*`). Providers
  themselves are in scope, see decision 20.
- Editing skills, tools, MCP servers or plugins in the app. Those live in the engine's `config.yaml`
  and the skills directory. A bot can write skills itself (`skill_manage`).
- Per-bot tool toggles. Add later if editing YAML becomes annoying (about 50 lines).

## Anti-goals (would make it a failure even if it works)

- Carrying over old desktop chrome that Petar does not use: sessions list and tabs, command center,
  command palette, starmap, capabilities browser, plugins system, multi-pane and preview tiles,
  updates feed, identity switching, pets, HUD, quick entry, the toolbar icons 2-5.
- Keeping the old Talyx features dormant "just in case". They are deleted.
- Any orchestration logic in the app. Bot-to-bot delivery, group rooms, cron all run in the
  engine gateway. The app is a client.
- The engine's branded avatars (the faces, shapes and gradients). Talyx gets its own flat set.

## Constraints

- Backend: the stock engine as installed by the user. The app attaches to the per-host gateway with
  `talyx --profile <name> gateway ensure --json` exactly as the engine's desktop app does
  (`apps/desktop/electron/local-gateway.ts`), and never owns or kills that process.
- Protocol: the engine's "canonical" gateway websocket protocol and its HTTP API are not
  versioned for third parties. The app vendors the client (`canonical-protocol.ts` and the
  `api/*.ts` wrappers) and follows upstream when it changes. This is the accepted maintenance
  cost.
- Existing data must keep working unchanged: profiles in `~/.talyx/profiles/<name>/`, the six
  hosted rooms in `~/.talyx/state.db` (57 events, including "AgroOps Team Group Chat" and
  "AgroOps Clients Group Chat"), cron jobs in `~/.talyx/profiles/<name>/cron/jobs.json`,
  bot `ui_meta['talyx-bots']` (shape, colour, title, pinned, pinnedOrder, sectionId).
- Talyx repo rules (`CLAUDE.md`): Electron 44, React 19, TS strict, Tailwind 4, shadcn/ui,
  Zustand, electron-vite, Vitest, Prettier (single quotes, no semicolons, 100 cols), FSD
  layers (`app/pages/widgets/features/shared`) with alias imports.
- Talyx design rules (`website/src/pages/design/DesignPage.tsx`): five type steps; one ground
  (`--color-bg`), one tone step (`--color-bg-secondary`), one ink, one action colour; no icon
  cards, eyebrows, hairlines, gradients, glass or resting shadows; surfaces separate by a tone
  step, never a line; running text 16px or more in full ink; one button shape, the full pill;
  a second action is an underlined link. App tokens live in `src/renderer/src/assets/theme.css`
  (brand `oklch(0.55 0.16 285)`, neutral ink, sidebar tokens, light and dark).

## Decisions (Petar's, unless marked "my call")

1. **Pivot the Talyx app itself**, same name, same brand, same repo. Not a sub-app, not a new
   repo.
2. **The old app is preserved** on branch `legacy/file-organizer` and tag `v0.11.0-legacy`
   (both at `cefebb6`, pushed to origin on 2026-11-04). The README after the pivot links them
   under "Before the pivot". **Delete the old features** from `main`: sorting, watch folders, history, the hotkey assistant overlay,
   voice (whisper/Kokoro), the MCP server, the Claude SDK providers, the welcome tour. Their
   dependencies go with them (`@anthropic-ai/*`, `@huggingface/*`, `@modelcontextprotocol/sdk`,
   `onnxruntime`, `pdf-parse`, `mammoth`, `xlsx`, `exifr`, `music-metadata`, `mailparser`,
   `chokidar`, `cheerio`, `phonemizer`, `thinking-orbs`). My call: delete in the first step, not
   at the end; git history keeps them.
3. **Move the engine desktop's bots UI over and restyle it**, rather than rewrite it. Source:
   `apps/desktop/src/plugins/talyx-bots/` plus the composer and the slice of the plugin SDK
   host surface it uses. My call: its state libraries (nanostores, react-query) come along;
   Zustand stays for app-level state. Two state libraries side by side is accepted for now.
   **Exception, the transcript (Petar's decision):** The old desktop renders it with
   `@assistant-ui/react` plus a 5k-line session store (about 24k lines together). That stack is
   not moved. Talyx gets its own small transcript on the gateway session events, rendered with
   Talyx's existing `react-markdown`: text, tool-call lines, clarify and approval cards,
   images. Reasoning blocks, media players and inter-agent collapse are not in 1.0.
4. **Bots are the only sidebar content.** No SESSIONS/BOTS tabs. Sessions still exist in the
   backend (every chat is a session) but there is no sessions list.
5. **The manager bot delegates through the engine.** No app logic needed: the `message_agent` tool in the backend
   (`tools/bot_mode_dm.py`) delivers between profiles on the same host, and `talyx peer dm`
   handles registered peers. The desktop-side cross-connection relay (`relay.ts`,
   `bot_relay.outbox.drain`) is not ported.
6. **Group chats use backend hosted rooms only** (`groups.*` RPCs, `HostedRoomService`). The
   legacy desktop-run group mode (`group-rounds.ts`, `group-turns.ts`, localStorage room log)
   is not ported. History: all of Petar's rooms are already hosted rooms, nothing to migrate.
7. **Folders are stored in the backend**, in the default profile's `ui_meta` (my call: key
   `talyx-folders`, same shape as today's `bot-sections-v1` record), so every machine sees the
   same layout. Bot membership stays in each bot's `ui_meta['talyx-bots'].sectionId` as today.
8. **Details panel replaces Edit Profile**, with tabs Details (incl. routines), Look, Soul.
   Capabilities tab dropped. Save semantics as in the old desktop today. Create-bot keeps its own dialog.
   Built in PR 5 (2026-11-04): SOUL is read and saved over the socket (`profiles.describe` /
   `profiles.configure`), not the `/soul` REST path; routines go through `cron.manage` and apply
   when toggled, not on Save; new routines post into the bot's chat by default. The Look tab and the
   create dialog's look stay a placeholder until PR 8 (Petar, 2026-11-04).
9. **Composer behaviour kept** (`+`, placeholder, model chip, reasoning level, mic, chevron);
   visual restyled to Talyx. **Voice is dictation only** (Petar's decision): the mic button
   transcribes into the composer through the gateway's `/api/audio/transcribe-stream`. The
   old desktop's voice-conversation mode (wake word, spoken replies, engine picker) is not moved.
   Revised for PR 4 (Petar's decisions, 2026-11-04): the composer is written new, with the old
   desktop's composer only as a reference (its queue, slash commands and popout are not moved),
   and dictation in 1.0 is one-shot through `POST /api/audio/transcribe` (the text lands when
   recording stops); streaming through `/api/audio/transcribe-stream` comes later. Editing a sent
   message is not in 1.0; a rewind from another client rebuilds the transcript.
10. **Avatars: Blocks** (decided 2026-11-04; fallback: Tiles).
    Every bot is an isometric block drawn from the Talyx mark: one of 6 voxel shapes (cube,
    tall, slab, stair, twin, tower; Petar dropped corner and pile on 2026-11-04) in one of 12 hues, three flat lightness steps
    per hue (oklch L 0.90 / 0.70 / 0.52), no gradients. Rendered as SVG in code
    (`shared/ui/BlockAvatar.tsx`) at 24, 44 and 64px. A small face of straight strokes only
    (two tick eyes, one segment mouth, in the hue's darkest tone; no curves, Petar's call)
    sits on the front face at 40px and above; 24px rows show the plain block. An expression is
    an angle: idle = vertical ticks, flat line; working = ticks at 35° toward the work, short
    line, slow bob; waiting on you = one tick plus a brow at 62°, open-angle mouth, violet dot;
    offline = ticks flat, chroma 0. Ticks rotate between states (200 ms); shapes never swap.
    Motion is CSS/SVG only, transform and opacity, off under reduced motion; no three.js (the
    roster draws 11+ avatars, WebGL would cost a context each, blur at 24px and add ~600 kB).
    Motion map: roster row 24px, only the dot fades; pinned tile 44px, blink every 4-6 s, bob
    when working, 2px lift on hover, ticks rotate on state change; name pill, nothing; details
    hero 64px, blink, turns a few degrees toward the cursor by re-projecting the isometric
    angle on pointer move, bob when working; thread, the sender's 24px block bobs beside
    "typing"; group pile, the speaking member bobs; Look preview crossfades and turns once. A group
    shows up to three member blocks side by side. The manager bot (the default profile) is the logo as a block in
    black and white: the mark's hexagonal silhouette in three greys (top #e9e9ee, front
    #2a2a30, side #141418), the logo's three stripes in mid grey (#7a7a84) on top, and the same
    tick face in white. It is the one bot without a hue; that is how the manager is told apart. Data: `ui_meta['talyx-bots']` keeps `shape` and `color`; new values are the shape
    name and hue index; old values map once (hue from the hsl string, shape from a hash of the
    blobatar id); bots with no values get "Match the name" (hash of the name) written back
    through `profiles.configure`. A 1024px PNG is exported as the profile asset so other engine
    surfaces match. The profile's old `avatar.png` is overwritten by that export. No upload in
    1.0. Faces are on by default (Petar, 2026-11-04), one flag turns them off; no initials on
    the blocks. Fallback if blocks feel too playful after a day: Tiles, a rounded square in a pale tint
    with the initial in the hue's ink, same data, renderer swapped.
11. **English only** (Petar's decision). The engine has no Bulgarian bundles; its seven locale
    bundles are not moved. Talyx keeps its own `shared/lib/i18n.ts`; Bulgarian can be added
    later as one file.
12. **Local only in 1.0** (Petar's decision). A stock gateway listens on loopback and admits
    sockets by one-use tickets minted through the profile's control socket, so there is no
    gateway URL field. Remote machines (SSH route or engine peers over Tailscale) are a later
    PR.
13. **Backend presence** (my call): on launch the app runs `talyx --version`; if missing it
    shows one line with the install command and a retry button. No bundled Python.
14. **Version** 1.0.0 at the pivot (my call). The website is updated in its own PR after the
    app ships (see the plan).
16. **The engine's name is never used in the app or the code** (Petar's decision). The backend is "the
    engine": `shared/engine/` for the vendored client, `infrastructure/engine/engine.ts` in
    main for the CLI wrapper, `EngineStatus` in settings, `scripts/talyx-engine` for install.
    Its real name appears only inside `engine.ts`, the README and the install script. The
    first-launch screen says "Talyx needs its engine" and runs `talyx-engine install`.
17. **The manager bot is called Talyx** (my call, from Petar no longer addressing the engine by name): the `default`
    profile shows as "Talyx" with the logo as its avatar. Its SOUL and routines are unchanged.
18. **The details panel pushes the chat** (Petar's decision): a third column of 340px, not an
    overlay. The thread narrows; nothing is covered.
19. **Three platforms, none signed** (Petar's decision). electron-builder targets: macOS DMG,
    Windows NSIS installer, Linux AppImage and deb. `engine.ts` resolves the engine binary per
    OS (PATH first, then the per-OS install location) and `talyx-engine install` runs in a
    Windows and a Linux shell. The old "macOS only" line in `CLAUDE.md` and the README goes.
20. **Providers are kept and editable in the app** (Petar's decision). Today's setup is one
    custom OpenAI-compatible endpoint (`provider: custom`, `base_url:
    http://127.0.0.1:20128/v1`, a Docker-hosted router serving 9 models, default model
    `team-manager`) in the engine's `config.yaml`. The pivot never touches that file. A
    Providers settings page, moved from the old app's `providers-settings.tsx`,
    `custom-endpoints-settings.tsx`, `env-credentials.tsx`, `model-settings.tsx` (about 3.8k
    lines) over the `api/config.ts` endpoints (env credentials, custom endpoints, OAuth
    providers, global model), lets Petar add API-key, OAuth and custom-endpoint providers and
    set the default and fallback models. The per-bot model picker reads the same list.
15. **Engine version** (my call): the vendored client is cut from the `v0.22.5` tag, the
    installed release (`talyx --version` -> 0.22.5, `bf0203a`), and that version is pinned in
    the README. Upgrading the engine means re-syncing the vendored folder against the new tag.

## Architecture

```
Talyx app (Electron)
  main/          attach to engine gateway (gateway ensure), window, settings JSON
  preload/       typed IPC bridge (as today)
  renderer/
    app/         providers, Zustand app state, theme
    pages/       AgentsPage (sidebar + chat), SettingsPage (gateway URL, theme)
    widgets/     Roster (pinned grid, folders, bot rows, group rows), ChatPane,
                 DetailsPanel, CreateBotDialog
    features/    chat (transcript, composer, clarify/approval cards),
                 bots (profile data, folders, pins, routines, soul, avatar),
                 groups (hosted rooms: list, history, send, activity)
    shared/      ui (shadcn), engine/ (vendored: canonical protocol client,
                 HTTP api wrappers, gateway socket), lib, hooks
Engine gateway (stock, one process per host, outlives the app)
  profiles, sessions, message_agent, hosted rooms, cron, skills/tools/MCP
```

Data flow: renderer talks to the gateway over the websocket (sessions, prompts, `profiles.*`,
`groups.*`, `cron.manage`) and over HTTP (`/api/profiles`, `/api/cron/jobs`). Main process only
ensures the gateway and holds settings.

### What moves from the old desktop fork's `apps/desktop/src` (restyle, keep logic)

- `plugins/talyx-bots/`: roster (`roster-pane*.tsx`, `roster-sections.tsx`, `pinned-grid.tsx`,
  `pinned-bots.ts`, `user-sections*.ts(x)`, `bot-row.tsx`, `group-avatar-cluster.tsx`),
  chat screen (`screen-*.tsx`, `bot-name-pill.tsx`, `chat-empty.tsx`, `canonical-chat.ts`),
  details (`bot-details-panel.tsx`, `bot-details-routines.tsx`, `details-panel-state.ts`,
  `profile-config.tsx`, `soul.ts`, `cron.tsx`, `model-picker.tsx`, `create-dialog.tsx`),
  data (`data.ts`, `types.ts`, `profile-ops.ts`, `routing.ts`, `recent-session.ts`,
  `hidden-bots.ts`, `labels.ts`, `i18n*.ts`), hosted groups (`canonical-group*.ts(x)`,
  `canonical-groups.ts`).
- `app/chat/composer/` (the composer only; dictation hook `use-mic-recorder.ts`). The
  transcript, clarify and approval cards are written new (decision 3); the old desktop versions in
  `components/assistant-ui/` serve as reference for the event shapes.
- `api/`: `client.ts`, `canonical-protocol.ts`, `profiles.ts`, `sessions.ts`, `cron.ts`,
  `models.ts`, `config.ts` (only what the above import).
- `sdk/`: the `host.*` surface the plugin uses (about 40 calls: `notify`, `request`, `onEvent`,
  `openSession`, `newChat`, `requestProfile`, `profileRoutes`, `agents`, `state.*`,
  `connections`, `retainProfile*`, `warmProfile`, `deleteProfile`, `paneVisibility`,
  `openWorkspace`...). Reimplemented as one plain module, not a plugin host.
- `electron/local-gateway.ts` and the `gateway ensure` call site in `electron/main.ts`.

### What is not moved

`relay.ts`, `relay-budget.ts`, `group-rounds.ts`, `group-turns.ts`, `group-chat*.ts(x)`,
`group-round-*.ts`, `group-slash.ts`, `group-compress.ts`, `group-external-writes.ts`,
`group-hold-status.tsx`, `group-panes.ts`, `group-pin.ts` (replaced by backend storage),
`skills-hub.tsx`, `mcp-setup.tsx`, `pet.tsx`, `avatar*.ts(x)` (replaced), `session-sweep.ts`,
`hygiene.ts`, `screen-install.tsx` (replaced by decision 13), the plugin registration
(`plugin.tsx`), and everything outside the lists above.

### What is deleted from Talyx

`src/main/domain/*`, `src/main/infrastructure/{agent,ai-providers,brains,assistant,voice,
workers}`, `src/main/mcp/`, `src/renderer/assistant/`, `src/renderer/src/features/*`,
`src/renderer/src/pages/{sort,watch,history,search,ask}`, `widgets/{tour,welcome}`, the
related IPC handlers, SQLite tables and migrations, tests, and the dependencies in decision 2.
`better-sqlite3` goes unless the builder finds a reason to keep it (settings are a JSON file).

## Left to the builder

- Order of work. Suggested: (1) delete old Talyx, (2) vendor the engine protocol and API client
  and prove a chat round-trip with one profile, (3) roster and folders, (4) chat and composer,
  (5) details panel, (6) hosted groups, (7) restyle pass against the design rules, (8) avatars
  with Petar, (9) packaging and the install-over-the-old-desktop-build test.
- Exact folder-to-FSD mapping of each moved file; how much of the old desktop component kit
  (`Button`, `Input`, `Codicon`, `ConfirmDialog`, `RowButton`, `Tip`) is swapped for shadcn
  versus kept behind a thin shim. Icons: lucide (Talyx) replaces Codicon where practical.
- Test strategy: keep the moved engine-client unit tests that still apply (protocol, data, folders,
  pins); drive new behaviour through use-case level tests, not transport.
- How the main process stores the gateway URL and theme (extend the existing `SettingsStore`).
- What the empty state says before the first bot exists, and the install hint wording.

## Open risks

- Protocol drift: an engine upgrade can break the vendored client. Mitigation: pin the engine
  version in the README, keep the client in one folder, run the moved protocol tests.
- Composer and transcript are entangled with the old desktop's tabs, panes and preview tiles. Untangling
  them is the largest single task. Expect a few days.
- Two state libraries. Acceptable now; consolidate on Zustand if it hurts.
