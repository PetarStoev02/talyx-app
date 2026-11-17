# Talyx verification map

The maintained source for verifying Talyx from the user's side. Read this index, then the feature
file as the recipe. Names here are the words the app shows, which are also the words to use in
prompts and PR descriptions.

## Baseline preconditions

- Launch with `control-talyx launch --no-engine --seed /tmp/talyx-verify/seed.json` where the
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

Engine-free (provable with `--no-engine`):

- [Theme](./settings-theme.md): Settings, General, Appearance: Light, Dark, System. Proven 2026-11-17.
- [Engine gate](./engine-gate.md): "Talyx needs its engine." with Install, Try again, Choose file.
- [First-run setup](./first-run-setup.md): Welcome, then Engine, Provider, First bot.

Engine-backed (need `launch` without `--no-engine`; see Real-engine rules in SKILL.md):

- [Create a bot](./create-bot.md): the roster's add button, the New bot dialog, the new row.
- [Send a message](./chat-send.md): the composer, the queued turn, the reply in the transcript.
