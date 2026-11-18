---
name: verify-talyx
description: Drive the real Talyx desktop app (Electron, dev build) the way a user does and capture proof. Use before claiming a UI change works, for "verify in the app", "prove it works", "screenshot the change", or when a PR touches src/renderer, src/main or the roster, chat, settings and setup screens.
---

# Verify Talyx

Talyx is an Electron app. This skill starts a throwaway dev copy with its own user data, drives
the real window over the Chrome DevTools Protocol with `control-talyx`, and keeps evidence under
`/tmp/talyx-verify/evidence/`. Read `features/README.md` for the feature map, then the feature
file you are proving.

Helper: `node .claude/skills/verify-talyx/control-talyx.mjs <command>` from the repo root. Below,
`control-talyx` means that. It needs `node_modules` (`npm ci`, then
`node node_modules/electron/install.js` in a fresh worktree).

## Launch

```sh
control-talyx launch --no-engine --seed <settings.json>   # isolated: no engine, no real bots
control-talyx launch                                       # attaches to this machine's real engine
```

- Starts `electron-vite dev` with `--user-data-dir=/tmp/talyx-verify/run/userData` and
  `--remote-debugging-port=9333`, bridge port 5195, MCP port 47899. It never touches the installed
  Talyx or `~/Library/Application Support/talyx`, so the installed app can stay open.
- `--no-engine` hides the engine: `HOME` becomes `/tmp/talyx-verify/run/home` and every `PATH`
  entry holding `talyx-engine` is dropped. The app then shows setup or "Talyx needs its engine."
  Without it the app attaches to the real engine and its real profiles.
- `--seed <file>` copies a `settings.json` into the fresh user data. `{"setupDone": true}` skips the
  first-run flow. Without a seed the first-run Welcome shows.
- Ready means the main window answers over CDP and shows its first heading or the roster. The
  command then waits 3 s for the dev build's one-time reload and checks again. It prints the pid,
  window title and user data path, or fails with the log path (`/tmp/talyx-verify/run/talyx.log`).
- One run at a time per root: `launch` refuses while a pid is alive. Run `stop` first. Another
  session's run is not yours to stop: give yours its own root and ports with
  `TALYX_VERIFY_ROOT`, `TALYX_VERIFY_CDP_PORT`, `TALYX_VERIFY_BRIDGE_PORT` and
  `TALYX_VERIFY_MCP_PORT`.

## Doctor

```sh
control-talyx doctor
```

Read-only. Checks the pid is alive, CDP answers at `http://127.0.0.1:9333`, the run directory
exists, and names the window. Run it first whenever a step looks wrong.

## Drive

```sh
control-talyx browser click --role button --name "Settings"
control-talyx browser click --role button --name "Dark" --exact
control-talyx browser fill --role textbox --name "Name" --value "Scratch bot"
control-talyx browser select --role combobox --name "Folder" --value "Unassigned"   # native <select>
control-talyx browser press --key Escape
control-talyx browser wait --role heading --name "Settings: General" [--timeout 10000]
control-talyx browser snapshot [--path <file>]          # ARIA tree of the window (stdout or file)
control-talyx browser screenshot --path <file.png>
control-talyx settings                                   # the run's settings.json
```

- Selectors are ARIA role and accessible name, as the snapshot prints them. Never coordinates.
- `--name` matches a substring unless `--exact` is given; "Dark" also matches nothing else, but
  "Settings" matches "Settings" and "Close Settings", so use `--exact` on short names.
- Every command reconnects over CDP, so state must live in the app, not in the driver.
- Keyboard shortcuts work through `press` (`Meta+Comma` opens Settings, `Meta+Slash` the cheat
  sheet) but the clickable path is the one to prove.

## Evidence

Save under `/tmp/talyx-verify/evidence/<feature-id>/`:

- a screenshot of the action's result (`after.png`), and `before.png` when the change is visual;
- the ARIA snapshot of the end state (`after.aria.txt`);
- the side effect read back from storage: `control-talyx settings > settings.json` for anything
  Settings writes; for engine-backed features the engine's own view (a second screen that shows the
  bot or message, or a `talyx-engine` CLI read).

Proof standards: drive the user path (buttons, fields, shortcuts), never the dev bridge, IPC or a
store. Capture the action and the resulting state, not only the final screen. A pressed button is
not proof; the stored value or the second view is. Nothing here mocks the engine: `--no-engine`
hides it, and the real engine is real.

## Cleanup

```sh
control-talyx stop
```

Kills the process group it started (from `/tmp/talyx-verify/run/pid`, never by name), waits until
every process in it has exited (Electron quits after electron-vite), stops anything still running
from the run directory (the gateway of an engine setup installed into the run's home), and removes
`/tmp/talyx-verify/run/`. Evidence stays. Run it after every attempt, including failed ones; a
later `launch` refuses while any process in that group is alive.

## Real-engine rules

With the real engine attached, the roster and chats are the user's own. Look and navigate freely.
Create nothing without the user's approval; a scratch bot, when approved, runs on
`claude-haiku-4-5` and is deleted in cleanup. Never send messages to the user's existing bots,
never change their SOUL, routines or providers.

## Keep the map honest

`/pstack:maintain-verification-skill` re-reads the sources behind each feature file and fixes
stale handles and journeys. Run it after a screen changes.
