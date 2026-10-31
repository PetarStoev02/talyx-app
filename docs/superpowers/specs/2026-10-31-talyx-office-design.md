# Talyx Office: design

Date: 2026-10-31. Status: draft for approval.

Scope: the owner's personal build (decided 2026-10-31). It is built for this Mac, this Tailscale,
this T3 Code install and these Grok Bots. No migration for other users, no general onboarding, the
website is left as it is for now. A public release is a later decision.

## Intent

Talyx means "tally": count and sort into groups. Talyx pivots from a file organizer into a live
office for the owner's AI agents. The owner runs a "startup" of Grok Bots per project (for example
AgroOps: a core team that acts like a board, and a client panel of persona bots). The bots talk in
group chats, talk to each other, take direct tasks, and some of them drive T3 Code on the owner's
Mac to write code.

Today none of that is visible in one place. Talyx shows it as a 3D office the owner opens every
day: each bot is a character, rooms are the groups, and where a bot stands is its status. The
owner can also hand a bot a task from the office.

The office sorts the bots into rooms and counts them: that is the name, and the top bar shows the
count per room.

## Goals

- See at a glance, for one project, which bots are in which group chat, which are working on a
  task (and on what), and which are idle.
- See what is being said: the latest line each bot reports, as a speech bubble and in a feed.
- See real T3 Code activity on this Mac (threads and runs) attributed to the bot that drives it,
  including T3 threads that are waiting for an answer.
- Start a T3 thread or send a message to one from the office.
- Send a task to a specific bot from the office and see its result come back.
- Several projects, each its own office with its own rooms, chosen from a switcher.

## Non-goals (v1)

- Reading Grok chats directly. Grok Bot has no read API, export or event stream (checked in the
  xAI docs and confirmed by the owner's bots on 2026-10-31). Talyx shows what bots report.
- Showing "waiting for approval" inside Grok. It cannot be observed.
- Creating, configuring or deleting Grok Bots, groups or routines from Talyx.
- Windows or Linux. Mobile.
- Any model running inside Talyx. Talyx no longer has an assistant of its own.

## Anti-goals (a failure even if it works)

- Webhook keys or the inbound token reaching the renderer, a log, a chat, or a git commit.
- An office that looks busy but lies: a bot shown working long after it stopped, with no sign
  that the information is stale.
- A dashboard of tables. The office scene is the product; panels support it.
- Rebuilding the old Talyx inside the new one. The old features go.

## Constraints

- macOS only, Electron 44 (macOS 13+), the existing stack: React 19, TypeScript strict,
  Tailwind 4, Zustand, better-sqlite3, electron-vite, Vitest. Project conventions in `CLAUDE.md`.
- Grok Bots run on Cursor-hosted cloud computers. They cannot reach `localhost`. They can make
  HTTP requests to a public URL.
- The only official control path into a bot is a routine with a webhook trigger: `POST` to a URL
  of the form `https://api2.cursor.sh/automations/webhook/<id>` with `Authorization: Bearer <key>`
  and an optional JSON body, which the bot receives together with the routine's instruction (xAI
  docs, "Skills and routines"). A `200` means the run started, nothing more. Limits: 300 runs per hour
  across routines, 200 per routine.
- The owner has Tailscale installed locally (1.104.4) and chose Tailscale Funnel as the public
  address for the Mac.
- T3 Code on this Mac: local server at `http://127.0.0.1:3773` (from
  `~/.t3/userdata/server-runtime.json`), state in SQLite at `~/.t3/userdata/statev2.sqlite`
  (tables `projection_projects`, `orchestration_v2_projection_threads`,
  `orchestration_v2_projection_runs`, `orchestration_v2_projection_messages`; a thread's
  `payload_json` carries `createdBy`, `creationSource`, `projectId`, `title`; a run has `status`:
  queued, running, completed, failed, cancelled, interrupted). The file is about 4 GB and in use.
  Talyx never writes to it.

## What was decided

### Data sources

1. **Bot reports (Grok).** Bots POST events to Talyx. This is self-reported: the office shows
   what bots say.
2. **T3 activity (observed).** Talyx watches T3 threads and runs on this Mac, read-only.
3. **Tasks out (official).** Talyx triggers a bot's webhook routine.

### Roster: config per project

The roster is owned by Talyx because Grok has no API to list bots. One config per project:

- project: id, name, the T3 project ids that belong to it.
- groups: id, name, kind (`team` or `clients`; free to add more later), which conference room it
  meets in.
- bots: id (stable slug, unique across all projects, e.g. `agro-ops-cto`), display name, color
  (matches its Grok avatar), one project, one or more groups (*builder's call, settled here:* a bot
  such as "Grok Bot" may sit in several groups of the same project), optional webhook URL, optional flag `drivesT3` (for example the bot `T3 Tots`).
- rooms: generated, not placed by hand (*settled here*). Each group gets a conference room; every
  office has one work room and one chill room. The owner can add a room (name and kind) and the
  layout places it. No floor-plan editor in v1.

Webhook keys are not in the config. They are stored per bot with Electron `safeStorage`, the same
way `src/main/infrastructure/agent/ApiKeyStore.ts` stores the API key today.

v1 edits the roster in a settings screen inside Talyx (add a bot, set its group and color, paste its
webhook URL and key). The first project, AgroOps, is entered by hand: team (CTO, Sales, Product
Lead, CFO, T3 Tots, Grok Bot), clients (Co-op Manager, Small Farm, Mid-size Farm, Agronomist,
Dealer Agronomist), groups "Agro Ops team" and "Agro Ops client panel".

### Inbound endpoint

- Talyx's main process runs one HTTP server bound to `127.0.0.1` on a fixed port. Tailscale Funnel
  publishes it on the owner's tailnet hostname over HTTPS.
- Every request needs `Authorization: Bearer <inbound token>`. Talyx generates the token, stores it
  with `safeStorage`, and shows it once in settings with the full URL to copy into the bots'
  instructions. The token can be rotated.
- One endpoint, `POST /events`, body JSON:

  ```json
  {
    "bot": "agro-ops-cto",
    "kind": "chat | task | idle | result | message",
    "group": "agro-ops-team",
    "task": "Building field report export",
    "text": "API is ready, who takes the UI?",
    "to": "agro-ops-sales",
    "runId": "optional id Talyx sent with a task",
    "at": "2026-10-31T10:00:00Z"
  }
  ```

  - `chat`: the bot is active in a group chat (`group` required, and the bot goes to that group's
    room even if it is not its first group); `text` is its latest line. The project comes from the
    bot's roster entry.
  - `task`: the bot started work (`task` required).
  - `idle`: the bot finished or stopped.
  - `result`: the outcome of a task Talyx sent (`runId`, `text`).
  - `message`: a bot-to-bot direct message (`to`, `text`).
- Unknown bot ids are rejected with 404 and logged by id only. Bodies are capped in size and
  validated at the boundary. The endpoint answers fast (it stores, then returns 202).
- Talyx manages the Funnel: it can turn it on and off from settings (by running the `tailscale`
  CLI) and shows whether it is reachable.

### Running in the background (*settled here*)

Talyx keeps running from the menu bar tray when its window is closed and can launch at login, so
it keeps collecting. The HTTP server belongs to the app, not the window. Events sent while Talyx is
quit are lost (the bot gets a connection error); the office marks that gap with the stale rule
below. Talyx turns the Funnel off when it quits.

### The bots' instructions

Talyx shows a ready-to-paste instruction block per bot (with its id, the URL and the token) that
tells the bot when to POST: when it starts talking in a group chat (and with each line it wants
shown), when it starts and finishes a task, and the result of any routine run Talyx started. The
owner pastes it into each bot once (or asks one bot to apply it as a skill for the team).

### T3 connector

T3 Code (open source, `pingdotgg/t3code`) has two official ways in, both documented in
`docs/user/outside-agents.md`: an MCP server for outside agents (OAuth sign-in, read-only by default,
"Supervised" or higher to start and message threads), and on the host the `t3 thread` command
(`~/.t3/bin/t3 thread list | start | send | show`, no sign-in, `--json` output, `send --wait` exits 2
when the agent waits for an answer). Talyx runs on the host, so it uses `t3 thread`.

The owner's bot "T3 Tots" is the open-source project `Deepusleepy/t3-tots` (MIT). It drives T3
through T3's internal local websocket API (`t3ctl`), reads `statev2.sqlite` read-only (`t3q.py`),
and its optional `t3listen` POSTs live T3 events to a webhook: `request.opened` /
`request.resolved` (a thread waiting on the owner and its answer) and `thread.finished` / `failed` /
`cancelled`. Its README says those internal interfaces can break on a T3 update.

- **Reading:** `t3 thread list` / `show` per mapped project, polled every few seconds, plus
  `t3listen` pointed at Talyx's `/events` endpoint for live events (Talyx accepts its event
  shape as a second input format). Reading `statev2.sqlite` read-only is the fallback if the CLI
  lacks something (for example runs across all projects).
- **Attribution, so the office does not lie:** a thread counts as a bot's work only when (a)
  Talyx started it for that bot, (b) the bot reported its thread id in a `task` event, or (c) the
  owner mapped that T3 project to a bot. T3 records only `createdBy` (`user`, `agent`, `system`) and
  `creationSource` (`web`, `mcp`, `server`, `provider`), never the bot, so other threads are not
  shown as a bot working. Unattributed running threads may show as an unnamed "T3" worker at a
  computer (builder's call whether v1 shows them).
- **Waiting on the owner:** a `request.opened` for an attributed thread makes that bot raise its
  hand at its computer, and the card offers "Open in T3". That is the one approval state Talyx can
  see.
- **Starting work:** "Give task" can target T3 directly: pick a mapped project, Talyx runs
  `t3 thread start <project> "<task>"` and seats the chosen bot at a computer with that thread.
  "Send to thread" on a working bot's card runs `t3 thread send`.
- A finished run frees the computer.
- "Open in T3" on the bot's card opens that thread in the T3 web app on the local server if a
  thread URL format can be confirmed; otherwise the button is left out of v1 (*settled here*).

### Tasks out

- "Give task" on a bot's card opens a text field. Talyx POSTs `{ "task": "...", "runId": "...",
  "replyTo": "<events URL>" }` to that bot's webhook with its key, from the main process only.
- The bot walks to a computer at once, marked as "starting". When `task` and then `result` events
  arrive, the bot shows the task, then the result in the feed, and returns to the chill room.
- Rate limits and failures (non-200) show as an error on the card and in the feed.

### Office logic

- Each bot has one current place, computed from its latest signal: a `chat` event goes to its
  group's conference room, a `task` event or a running T3 run goes to the work room, an `idle`
  event or no signal goes to the chill room. An observed T3 run beats a reported state.
- A signal goes stale. After a while without a new signal (initial value: 15 minutes, a setting)
  the bot walks to the chill room, and a bot whose last state is older than the stale time is
  drawn dimmed with "last seen 20 min ago".
- Every incoming event and every T3 change is stored in SQLite as an event log (for the feed and
  for history). The current place per bot is derived from it.
- The renderer receives place changes and new feed lines over IPC as push events.

### The office (screen)

The throwaway spike at `src/renderer/public/office.html` is the visual reference, not code to
keep. What it settled:

- A 3D office built with three.js, seen from the front, with orbit and zoom.
- Monochrome, matching the existing app: black ground, Geist, white text, two greys, solid panels,
  no blur or glow. The only colour is each bot's own avatar colour.
- Rooms in grey tones: one conference room per group, a work room with computers, a chill room.
  Only rooms in use exist; no empty placeholder rooms.
- Bots are rounded characters that walk between rooms. A speaking bot shows a bubble. A
  conference table lights softly when its chat is active; a computer screen lights when a bot
  works at it; the selected bot has a white ring.
- Top bar: Talyx mark, project switcher, count per room. Right: the roster grouped by group, with
  each bot's task and room. Bottom left: the feed of the last few events. A card for the selected
  bot: Give task, Open chat (opens the bot in the Grok app if a link is known), Open in T3.

The detailed visual design is the next step after this architecture.

### Ideas taken from Skydive (skydive.com, seen 2026-10-31)

Skydive is a hosted-agent product whose agents sit at desks in a 3D office. Talyx differs: it hosts
no agents and shows the owner's own. Taken from it:

- **A map of offices:** one office per project, and a map view to switch between them.
- **Capabilities as objects in the room:** a T3 terminal in the work room that shows whether T3 is
  connected, and a phone on each bot's desk spot that shows whether its webhook is set and working.
  Clicking an object opens its setting.
- **Customize office:** per project name, logo and the view out of the window, kept monochrome.

### What the old Talyx loses

Removed: file sorting and classification, Smart Local and Claude sorting, watch folders, the MCP
server and its tools, the assistant overlay and its abilities, voice (whisper, Kokoro), briefing,
capture, mail, search, scheduling, the welcome flow, and their settings, IPC channels, tables and
dependencies.

Kept: the Electron shell and window, the database setup and migration runner, the settings store,
`safeStorage` key storage, the tray if it still helps, IPC conventions, the React and Tailwind
setup and the monochrome theme.

`CLAUDE.md`, the README and the website copy are rewritten to describe the new product.

## Left to the builder

- The module layout inside `src/main` and `src/renderer` (following the project's clean
  architecture and FSD rules).
- How three.js is integrated (plain three.js or react-three-fiber), as long as it is bundled, not
  loaded from a CDN.
- The exact SQLite schema for the roster, event log and settings; the poll interval; the port.
- Whether the T3 connector reads SQLite or the T3 server, after checking what the server offers.
  Reading SQLite must be read-only and tolerate the file being busy.
- Order of removal versus building, as long as the app stays runnable at each step.
- Pathfinding (v1 may walk in straight lines through doorways only if simple; walking through
  walls is acceptable in the first version).
