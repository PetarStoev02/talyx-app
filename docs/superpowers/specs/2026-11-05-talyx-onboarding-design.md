# Talyx 1.0 onboarding: from first launch to a first chat

Date: 2026-11-05. Owner: Petar Stoev. Status: design, awaiting approval. Part of PR 10 ("Ship 1.0")
in `2026-11-04-talyx-pivot-plan.html`. It replaces decision 13 of
`2026-11-04-talyx-agents-pivot-design.md` (one line with the install command and a retry button)
and the "runs `talyx-engine install`" part of decision 16.

## Intent

Talyx 1.0 is for anyone with the repo link, not only Petar. That person downloads an unsigned
build, opens it, and usually has no engine installed. Today they land on "Talyx needs its
engine." with a Try again button and a Choose file link, and nothing tells them what to install or
how; even with the engine installed they must link it to `~/.local/bin/talyx-engine` by hand.

Onboarding takes them from first launch to a first chat without a terminal and without asking
Petar: install the engine, connect a model provider, make a first bot (or skip and talk to
Talyx).

## Goals

1. A first-time user reaches a working chat with Talyx in a few minutes, on macOS or Linux.
2. The engine install is one click (Install, with live output) or copy-paste (the exact commands,
   each with Copy). Both show the same commands.
3. Talyx finds the engine by itself once it is installed. The manual `ln -s` and Choose file are
   no longer needed (Choose file stays as a fallback).
4. Talyx checks the engine's version against the one it is built for (0.22.5) and says so.
5. Every failure (offline, a failed command, an old engine) says what happened and offers a way
   on.

## Non-goals

- Engine support on Windows. Talyx cannot attach to the engine on Windows yet (tickets are minted
  through the engine's own runtime there). On Windows the setup screen says 1.0 does not support
  the engine on Windows and links the release notes (Petar's decision).
- Installing Python or other prerequisites the engine's installer needs beyond what its commands
  do themselves.
- Updating the engine after onboarding (beyond the Update offered when an old engine is found).
- A tour of the app, tooltips or coach marks after the last step.

## Anti-goals

- The engine's name in git. The install commands name the engine, so they never go in the repo,
  in code, tests, docs, commits or PR text. They live only in a release asset and in a gitignored
  local file (see "The install file").
- A remote file that can change what Install runs on every user's machine. The file is pinned by
  a hash committed in Talyx (Petar's decision); a tampered or replaced asset is refused.
- Running anything the renderer supplies. The renderer can ask main to run "the install"; it can
  never pass a command.
- Nagging. Someone who skipped a step on purpose is not walked through the flow again.

## The flow

A clickable throwaway prototype of every screen was shown to Petar and approved on 2026-11-05
("I think it looks good"). Screens, in order:

1. **Welcome.** Logo, "Welcome to Talyx", one paragraph: Talyx tallies your AI bots; they run on
   the engine, a separate program on this computer; three short steps. Button: Get started.
2. **Looking for the engine.** Spinner while main runs the normal engine status check.
   - Found, version 0.22.5: screen 6.
   - Found, older than 0.22.5: screen 6b.
   - Found, newer than 0.22.5: screen 6 with a note that this version is newer than the one Talyx
     is tested with (my call).
   - Found but cannot attach (an error state other than missing): the existing error text and
     Try again, as the engine gate shows today, plus a link to continue to the install screen.
   - Missing: screen 3.
3. **Getting the install steps.** Spinner while main fetches and verifies the install file.
   Verified: screen 4. Fetch failed or hash mismatch: screen 4b.
4. **Install the engine.** Title, one paragraph (Talyx can run these for you, or copy them into a
   terminal; they install engine 0.22.5 for your user only). The commands for this OS, numbered,
   each with Copy; Copy all. Primary button: Install. A small "Installed it already? Choose file"
   link (the existing `engine:pick-path`). A footnote names the release the steps came from.
   - 4b. **The steps could not load.** "Talyx could not get the install steps." Try again, Open
     release page (the release matching this app's version), Choose file. A hash mismatch shows
     the same screen with its own sentence ("The install steps on the release page are not the
     ones this version of Talyx was built with.") and is logged.
5. **Installing.** Live output of each command, one after another, in a terminal-style panel that
   scrolls to the end. Cancel stops the running command and returns to screen 4. When the last
   command exits 0, Talyx re-runs the engine status check: attached goes to screen 6.
   - 5b. **The install stopped.** Which command failed and its exit code, the output kept
     on screen, Try again (runs all commands again from the first), Show the commands (screen 4),
     Copy output.
   - Install finished but the engine is still not found: screen 5b with the sentence "The
     commands finished but Talyx cannot find the engine." and Choose file.
6. **The engine is ready.** Badge "engine 0.22.5", where it was found, Continue.
   - When the gateway still runs older code than the engine (`stale: true` from `gateway ensure`,
     typical right after an Update while an old gateway keeps serving), the screen says so and
     shows the restart command with Copy (the existing `engine.stale` text). Talyx never restarts
     the gateway itself: main never owns or kills it (my call).
   - 6b. **Your engine is older than Talyx expects.** Its version and the expected one. Update to
     0.22.5 (runs the install, screen 5) or Continue anyway.
7. **Connect a model provider.** The same choices Settings offers (API key providers, account
   sign-ins, custom endpoint), built from the same feature code (`features/providers`) and the
   same forms. Continue is enabled once one provider is saved or signed in. Skip for now.
8. **Talyx's model.** The default model picker from Settings (`DefaultModelSection`): Talyx uses
   it and new bots copy it. Continue, Back.
9. **Make your first bot.** Name, look (the block avatar picker), "What it does" (one line, saved
   as the bot's SOUL). Make bot uses the existing create-bot use case (`features/bots/create`).
   Skip ("Skip, I'll talk to Talyx first").
10. **Done.** The normal app opens with Talyx's chat selected (and the new bot in the roster, if
    one was made).

A step bar (Engine, Provider, First bot) sits in the title row from screen 2 to 9. The window has
no sidebar during onboarding; the title row stays draggable.

### Skipping what is already done (my call)

The flow starts at the first step that is not already done: an attached engine with the right
version skips to the provider step; a saved provider skips to the first-bot step; any bot other
than Talyx skips the first-bot step. Petar's own machine therefore goes straight to Done.

### When onboarding shows (Petar's decision)

Until it is finished once. Reaching Done (by finishing or skipping through) sets
`setupDone: true` in `settings.json`. After that:

- A missing engine shows the existing "Talyx needs its engine." screen. Its primary button becomes
  "Install the engine", which opens screens 3 to 6 on their own and returns to the app.
- Settings gets "Run setup again", which clears nothing and opens the flow at Welcome; the
  already-done steps are skipped as above.

### No provider (Petar's decision)

The provider step is skippable. While no provider exists, Talyx's chat shows a one-line notice
above the composer, "Add a model provider so bots can answer.", with a button that opens Settings
at Providers. It goes away by itself once a provider exists.

## The install file

### Contents

`engine-install.json`, a small JSON file. Proposed shape (the builder may refine the field names;
the schema is validated with zod in main):

```json
{
  "schema": 1,
  "engineVersion": "0.22.5",
  "platforms": {
    "darwin": { "commands": ["<command 1>", "<command 2>"] },
    "linux": { "commands": ["<command 1>", "<command 2>"] }
  }
}
```

The last command links the engine's binary to `~/.local/bin/talyx-engine`, which `engine.ts`
already looks up (`engineCandidates`). That is what removes the manual `ln -s`.

### What the commands must do (Petar writes them)

Petar writes the file himself (Petar's decision). The commands must:

- run unattended: no prompts, no `sudo`, no terminal needed (Install has no stdin);
- be safe to run again over an existing engine, because Update (screen 6b) and Try again
  (screen 5b) reuse the same list;
- end with the engine's binary linked at `~/.local/bin/talyx-engine` and the `default` profile
  able to answer `gateway ensure`.

The builder checks the first draft for anything interactive before wiring it to Install, and
builds against Petar's real file (its hash is the committed constant).

### Where it lives

- Petar keeps it as a gitignored local file at the repo root, `engine-install.json`.
- `scripts/release.sh` uploads it as an asset of the draft release, next to the builds and
  `SHA256SUMS`.
- Talyx fetches it from the release that matches its own version:
  `https://github.com/PetarStoev02/talyx-app/releases/download/v<app version>/engine-install.json`.
  Never from `latest`.
- In dev (`!app.isPackaged`), main reads the local file at the repo root instead, so onboarding
  can be built and tested before a release exists. The hash check still applies.

### Pinning (Petar's decision)

The SHA-256 of the file's exact bytes is committed in Talyx's main-process source as a constant
(a hash does not name the engine). Main refuses a file whose hash differs. Consequences:

- Changing the commands needs a new Talyx release. That is the accepted cost.
- `release.sh` fails before building if the local file is missing or its hash differs from the
  committed constant, so a release can never ship an app and an asset that disagree.
- A test pins that the constant is a 64-character hex string; a test can never contain the file.

## Running the install

All in main; the renderer only asks and listens.

- **Fetch:** main downloads the file (timeout, size cap of 64 KiB), checks the hash, parses it with
  zod, picks the commands for `process.platform`, and returns them to the renderer for display.
- **Run:** an IPC call with no arguments. Main runs the verified commands for this platform, one at
  a time, each as `$SHELL -lc '<command>'` (falling back to `/bin/bash`, then `/bin/sh`), so the
  user's login PATH applies. stdout and stderr stream to the renderer as they arrive (one event
  per chunk, with the command's index). The first non-zero exit stops the run and reports the
  index and exit code.
- **Cancel:** kills the running command's process group and reports "cancelled".
- **One run at a time:** a second run while one is active is refused.
- **Logs:** the log records which command index ran, its exit code, and a hash mismatch. It never
  records the commands' output (it can hold paths and tokens).
- **Linux:** the same as macOS. The AppImage and deb never rely on `--no-sandbox` (security audit,
  2026-11-05).

New IPC channels follow the existing `namespace:action` convention (for example `setup:install-steps`,
`setup:install-run`, `setup:install-cancel`, events `setup:install-output` and
`setup:install-exit`), are validated with zod at the boundary, and are added to `buildApi` in
`src/shared/api.ts`.

## Detection and version

- Detection is the existing `engine:status` (`--version`, then `gateway ensure`). It already
  tries the chosen file, then `talyx-engine` on PATH, then `~/.local/bin/talyx-engine`.
- On Linux and macOS the lookup uses absolute paths only for anything Talyx chose itself. Windows
  is out of scope for 1.0, but whoever adds it must resolve the engine to an absolute path (a bare
  command name makes Windows search the current directory first; security audit, 2026-11-05).
- An engine whose `--version` parses but whose attach fails still reports its version
  (`EngineStatus` gains an optional `version` on the error state), so an old engine that cannot
  attach reaches screen 6b instead of the generic error (my call).
- The expected version, `0.22.5`, is one constant in `src/shared/engine.ts` and matches the
  vendored client's tag (pivot design, decision 15). `EngineStatus` already carries `version`;
  the comparison is a small pure function with tests (older, same, newer, unparseable).

## Constraints

- Linux packaging (AppImage and deb) and the Linux side of `release.sh` are built in the same
  PR 10, as the plan's "Ship 1.0" section already says; onboarding is tested on a real Linux build
  before release.

- FSD layers as in `CLAUDE.md`: the flow is a widget (`widgets/setup/`) over a feature
  (`features/setup/`: the step state, which steps to skip, the version comparison); the app layer
  decides whether to show it from `setupDone`.
- Copy goes in `shared/lib/i18n.ts`.
- Light and dark themes, keyboard reachable, focus moved to each screen's heading on change.
- Tests drive the use cases (step skipping, version comparison, the install file's validation
  and hash check, the run's stop-on-first-failure), not IPC or the DOM.
- Interactions are tested on the synthetic roster fixture (port 5183), never on Petar's real
  profiles.

## Left to the builder

- Exact wording beyond the sentences quoted here, and the layout details of each screen (follow
  the prototype and the existing engine gate).
- Field names inside `engine-install.json`, as long as the shape above holds.
- How the step bar is drawn, and whether screens animate between steps.
- The size of the output panel and how much output it keeps.

## My calls (for Petar to check)

- Onboarding starts at the first step not already done, so an existing setup goes straight to
  Done.
- "What it does" on the first-bot screen becomes the bot's SOUL.
- Commands run one by one in the user's login shell, from main, with output streamed.
- A newer engine than 0.22.5 is accepted with a note, not a warning.
- The release page link on screen 4b points at the release matching the app's version.
- `setupDone` is the only new setting; "Run setup again" lives in Settings.
- A stale gateway after install or Update is reported with the restart command; Talyx does not
  restart it.
- An old engine that cannot attach still shows its version and the Update offer.
