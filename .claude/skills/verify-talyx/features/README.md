# Talyx verification map

The maintained source for verifying Talyx from the user's side. Read this index, then the feature
file as the recipe. Names here are the words the app shows, which are also the words to use in
prompts and PR descriptions.

## Baseline preconditions

- Launch with `control-talyx launch --seed /tmp/talyx-verify/seed.json` where the
  seed is `{"setupDone": true}`, unless the feature says otherwise.
- `control-talyx doctor` reports `ok`, the window `Talyx`, and `/tmp/talyx-verify/run/userData`.
- Never drive a Talyx this run did not start. The installed app may be open; leave it alone.

## Driving conventions

- Drive with `control-talyx browser <action> --role <role> --name <name>`; roles and names are
  what `control-talyx browser snapshot` prints.
- Start every recipe from the baseline state unless its preconditions say otherwise.
- Keep quoted names exact. Use `--exact` for short names that are substrings of others.
- Prefer the clickable path. Use `press` for shortcuts only when the feature is the shortcut.

## Proof and skip reporting

- Capture the action's result and the stored side effect, not only the final screen.
- UI proof is `after.aria.txt` plus `after.png` under `/tmp/talyx-verify/evidence/<feature-id>/`.
- A Settings change is proven by `control-talyx settings` showing the new value.
- An engine-backed change is proven by a second view: the roster after a reload, the chat's
  transcript, or the engine's own listing.
- Record the feature id and the entry point used with every artifact.
- Report an unreachable path with the command tried and the unmet precondition. Never report a
  skipped entry point as verified through another path.

## Feature entry contract

Each file: an H1, one paragraph of user-visible behavior, then exactly these four H2s in order:
`Sub-features`, `How to get to it (user POV)`, `Driving it with control-talyx`, `Gotchas`.

## Features

Engine-free (provable in an isolated run):

- [Theme](./settings-theme.md): Settings, General, Appearance: Light, Dark, System. Proven 2026-11-17.
- [Layout](./settings-layout.md): Settings, General, Appearance: Dock, Layered. Proven 2026-11-26.
- [Engine gate](./engine-gate.md): "Talyx needs its engine." with Install, Try again, Choose file.
- [First-run setup](./first-run-setup.md): Welcome, then Engine, Provider, First bot. Proven end to end 2026-11-18 (engine installed into the run's home).
- [Shortcuts sheet](./shortcuts-sheet.md): Meta+Slash opens "Keyboard shortcuts"; Escape or Close. Proven 2026-11-18.
- [Usage page](./usage-page.md): the footer's Usage, Period 7/30/90 days, Refresh usage, Close Usage. Proven 2026-11-18 (gate only).
- [Settings, Engine](./settings-engine.md): status, Check again, Choose file, Debug console. Proven 2026-11-18 (no engine).
- [Settings, About](./settings-about.md): version lines, Check for updates, Copy diagnostics. Proven 2026-11-18.
- [Update button](./update-button.md): Check for updates, the footer button and its Updates popover. Check proven 2026-11-18.
- [Module activation](./module-activation.md): no Modules page without a key; Enter license key. Hidden state proven 2026-11-18.

Engine-backed, read-only (the real engine, nothing created):

- [Settings, Providers](./settings-providers.md): the provider list, Add provider, Talyx's model.

Engine-backed (need `launch --real-engine`; see Real-engine rules in SKILL.md):

- [Create a bot](./create-bot.md): the roster's add button, the New bot dialog, the new row. Proven 2026-11-18.
- [Send a message](./chat-send.md): the composer, the queued turn, the reply in the transcript. Proven 2026-11-18.
- [Chat interface inside an answer](./chat-interface.md): a bot-drawn card in the transcript, `Your answer: {choice}`, `Show numbers`.
- [Bot details](./bot-details.md): the name pill's panel: Details, Look, Soul, Memory, routines. Details and Memory proven 2026-11-18.
- [Roster](./roster.md): folders, pins, hide, unread marks, bulk picks. Pins and folders proven 2026-11-18 on a setup-installed engine.
- [Rooms](./rooms.md): New room, members, who is answering, pin, delete.
- [Chat search](./chat-search.md): Meta+F, Messages found, Next match, Close search. Proven 2026-11-18.
- [Attachments and dictation](./attachments-dictation.md): Add images or files, Dictate.
- [Approvals and clarify cards](./approvals-clarify.md): the run card's answers, clarify choices.
