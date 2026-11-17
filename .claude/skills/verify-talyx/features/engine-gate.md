# Engine gate

When Talyx cannot find its engine after setup, the Agents page shows "Talyx needs its engine."
with three ways out: install it, look again, or point Talyx at the engine's file. The sidebar
footer stays, so Settings is reachable.

## Sub-features

- `gate-show` shows the heading, the explanation and the three actions when the engine is missing.
- `gate-try-again` looks for the engine again and stays on the gate when it is still missing.
- `gate-install` opens the setup flow at the Engine step.
- `gate-choose-file` opens a native file dialog (not drivable; see Gotchas).

## How to get to it (user POV)

- Start Talyx with setup done and no `talyx-engine` on `PATH`, no chosen file in Settings, Engine.
- From Settings, Engine, choosing a wrong file and returning to Agents.

## Driving it with control-talyx

Preconditions:

- Baseline launch (`--no-engine`, seed `{"setupDone": true}`).

- **Gate shows.** Run `control-talyx browser wait --role heading --name "Talyx needs its engine."`. The snapshot has `button "Install the engine"`, `button "Try again"`, `button "Choose file"`, and in the sidebar `button "Settings"` and `button "Usage"`.
- **Try again.** Choose `Try again`. Run `control-talyx browser click --role button --name "Try again" --exact`. The gate stays; `/tmp/talyx-verify/run/talyx.log` gains another `[Engine] Command not found` line.
- **Install.** Choose `Install the engine`. Run `control-talyx browser click --role button --name "Install the engine"`. The setup flow opens with the list `Setup steps` (Engine, Provider, First bot) and the Engine step's screen.
- **Proof.** Run `control-talyx browser snapshot --path /tmp/talyx-verify/evidence/engine-gate/after.aria.txt` and `control-talyx browser screenshot --path /tmp/talyx-verify/evidence/engine-gate/after.png`.

## Gotchas

- `Choose file` opens a macOS open panel that CDP cannot drive. Do not click it in a run; report
  it as not drivable.
- With the engine on `PATH` (no `--no-engine`) the gate never shows; the app attaches to the real
  engine instead.
- The Engine step after `Install the engine` fetches the install steps from the release page. In
  this run (2026-11-17, `--no-engine`) it showed "Talyx could not get the install steps." Treat
  that screen as the install step's offline state, not a failure of the gate.
