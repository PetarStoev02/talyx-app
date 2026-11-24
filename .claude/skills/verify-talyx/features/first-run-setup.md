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

- Launch with `control-talyx launch` and no `--seed` (fresh user data).

- **Welcome.** Run `control-talyx browser wait --role heading --name "Welcome to Talyx"`. The snapshot has one `button "Get started"` and no sidebar.
- **Start.** Choose `Get started`. Run `control-talyx browser click --role button --name "Get started"`. A list `Setup steps` with `Engine`, `Provider`, `First bot` appears and the Engine step shows.
- **Engine step without the install file.** A dev build reads `engine-install.json` from the repo root (a packaged build fetches it from the release). Without it the step shows `Talyx could not get the install steps.` with `Try again`, `Open release page`, `Choose file`.
- **Engine step with the install file.** Get it with `gh release download v<version> -p engine-install.json` into the repo root (gitignored; its SHA-256 must equal `ENGINE_INSTALL_SHA256`). The step shows `Install the engine`, the list `Install commands` and `button "Install"`. Run `control-talyx browser click --role button --name "Install" --exact`. In an isolated run the commands run with `HOME=/tmp/talyx-verify/run/home`, so the engine installs only there. After a few minutes the heading reads `The engine is ready.` with the path under the run's home; choose `Continue`.
- **Provider step.** The heading `Connect a model provider` shows the Providers section and `Continue` (disabled until a provider exists) and `Skip for now`. Add a provider as in settings-providers (a local OpenAI-compatible router works as `Custom endpoint`: `Name`, `Base URL`, `API key`, `Models`, then `Check` and `Save`). Pick that model under `Talyx’s model`, so new bots use it, then choose `Continue`.
- **First bot step.** The heading `Make your first bot` shows the create-bot form with `button "Make bot"`. Fill `Name` with `control-talyx browser fill --role textbox --name "Name" --value "Verify scratch"`, then run `control-talyx browser click --role button --name "Make bot"`. The Agents page shows with the roster (`Talyx` and `Verify scratch`) and `control-talyx settings` has `"setupDone": true`.
- **Proof.** Run `control-talyx browser snapshot --path /tmp/talyx-verify/evidence/first-run-setup/engine-step.aria.txt` and `control-talyx browser screenshot --path /tmp/talyx-verify/evidence/first-run-setup/engine-step.png`.
- **Rerun from Settings.** Launch with seed `{"setupDone": true}`, choose `Settings`, then `Run setup again`. Run `control-talyx browser click --role button --name "Settings" --exact` and `control-talyx browser click --role button --name "Run setup again"`. The `Setup steps` list shows again.

## Gotchas

- Proven end to end on 2026-11-18 in an isolated run: install into the run's home, a local
  router as `Custom endpoint`, `Make bot`, and one message answered by the new bot.
- `Install` runs the release's install commands. Click it only in an isolated run, where
  `HOME` is the run's home; with `--real-engine` it installs into the user's real `~/.local/bin`.
  It downloads the engine and its runtime (minutes, network).
- The installed engine starts its own gateway from the run's home. `control-talyx stop` stops
  everything running from the run directory by that path; it never calls the engine's own
  `gateway stop`, which could reach the user's gateway service.
- A provider key typed into the Provider step lands in the run's engine files and is deleted
  with the run directory by `stop`.
- `Open release page` opens the browser outside the app; CDP does not see it.
- A fresh run with the real engine on `PATH` skips the Engine step and starts at Provider.
