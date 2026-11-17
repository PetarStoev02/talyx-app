# First-run setup

On a fresh start Talyx welcomes the user and walks three steps: the engine, a model provider, a
first bot. Steps already done are skipped. The same flow reopens from Settings, General, Setup
("Run setup again") and from the engine gate's "Install the engine".

## Sub-features

- `setup-welcome` shows "Welcome to Talyx" with one `Get started` button.
- `setup-steps` lists `Setup steps`: Engine, Provider, First bot, marking done ones.
- `setup-engine` installs the engine from the release's install steps, or takes a chosen file.
- `setup-provider` connects a model provider (needs the engine attached).
- `setup-bot` makes the first bot (needs the engine and a provider).
- `setup-again` reruns the flow from Settings.

## How to get to it (user POV)

- Start Talyx with no `settings.json` (first run).
- Settings, General, Setup, choose `Run setup again`.
- The engine gate, choose `Install the engine`.

## Driving it with control-talyx

Preconditions:

- Launch with `control-talyx launch --no-engine` and no `--seed` (fresh user data).

- **Welcome.** Run `control-talyx browser wait --role heading --name "Welcome to Talyx"`. The snapshot has one `button "Get started"` and no sidebar.
- **Start.** Choose `Get started`. Run `control-talyx browser click --role button --name "Get started"`. A list `Setup steps` with `Engine`, `Provider`, `First bot` appears and the Engine step shows.
- **Engine step, offline.** With no network to the release page the step shows `Talyx could not get the install steps.` with `Try again`, `Open release page`, `Choose file`. With network it shows `Install the engine` with the commands and `Install`.
- **Proof.** Run `control-talyx browser snapshot --path /tmp/talyx-verify/evidence/first-run-setup/engine-step.aria.txt` and `control-talyx browser screenshot --path /tmp/talyx-verify/evidence/first-run-setup/engine-step.png`.
- **Rerun from Settings.** Launch with seed `{"setupDone": true}`, choose `Settings`, then `Run setup again`. Run `control-talyx browser click --role button --name "Settings" --exact` and `control-talyx browser click --role button --name "Run setup again"`. The `Setup steps` list shows again.

## Gotchas

- Everything past the Engine step needs a real engine; `--no-engine` runs end at that step. The
  Provider and First bot steps are unverified by this skill so far.
- `Install` runs the release's install commands on this machine. Never click it in a verification
  run on a developer's machine; it installs software into `~/.local/bin`.
- `Open release page` opens the browser outside the app; CDP does not see it.
- A fresh run with the real engine on `PATH` skips the Engine step and starts at Provider.
