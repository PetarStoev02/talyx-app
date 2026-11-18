# Engine settings

Settings, Engine shows how Talyx finds its engine. The status line reads "Attached", "Not found", "Looking for the engine…", "Error: …" or "Protocol mismatch". When the engine is attached it also shows "Version …" and "Runs <path>". "Check again" looks for the engine again, spins for at least a moment and then shows "Checked just now". "Choose file" opens the system file chooser so the user can point Talyx at the engine's file. When the engine is missing or older than expected, "Install the engine" or "Update the engine" appears too. The "Agents" block offers "Copy the add line" for outside agents. "Debug console" expands a panel. If the engine is missing, the panel shows "Talyx needs its engine.". If the engine is attached, the panel shows a Profile picker, Send "ping", "Drop socket", "Clear", the connection state and a log that reads "Events appear here." until raw session events arrive.

## Sub-features

- `engine-open` reaches the Engine page from Settings' sidebar row "Engine, Where it runs, debug console".
- `engine-state` shows the status line, and when attached the version and path.
- `engine-check-again` runs a fresh check and shows "Checked just now" (also read to screen readers by a hidden status line).
- `engine-choose-file` opens a native file dialog (cannot be driven, see Gotchas).
- `engine-install` appears only when the engine is missing or old. It goes to the Agents page and starts the install there.
- `engine-console-open` toggles "Debug console" (`aria-expanded`). With the engine missing, the panel shows the engine gate.
- `engine-console-ping` (needs the real engine) is Send "ping": it creates a session titled "Talyx engine debug" in the chosen profile, sends "ping" and logs the receipt and events.
- `engine-console-drop` closes the gateway socket so the reconnect can be seen. `engine-console-clear` empties the log.

## How to get to it (user POV)

- Choose `Settings` in the sidebar footer, then the `Engine` row in the Settings pages.
- Press `Meta+Comma`. Settings opens on the last page it showed.

## Driving it with control-talyx

Preconditions:

- Baseline launch (`--no-engine`, seed `{"setupDone": true}`) for everything except the console's live controls. Those need `control-talyx launch` with the real engine (see Real-engine rules).

- **Open Settings.** Each Settings page button is named by its title plus its detail line (`Engine Where it runs, debug console`), so match the detail. Run `control-talyx browser click --role button --name "Settings" --exact`, then `control-talyx browser click --role button --name "Where it runs, debug console"`. Then run `control-talyx browser wait --role heading --name "Engine" --exact`. The page shows "Not found", the buttons `Check again` and `Choose file`, the button `Install the engine` and the collapsed button `Debug console`.
- **Check again.** Run `control-talyx browser click --role button --name "Check again" --exact`. The page stays on "Not found" and the text "Checked just now" appears. `/tmp/talyx-verify/run/talyx.log` gains another `[Engine] Command not found` line.
- **Open the console (no engine).** Run `control-talyx browser click --role button --name "Debug console" --exact`. The button is `[expanded]`, and inside the panel the heading `Talyx needs its engine.` shows with its own `Install the engine`, `Try again` and `Choose file`.
- **Proof.** Run `control-talyx browser snapshot --path /tmp/talyx-verify/evidence/settings-engine/after.aria.txt` and `control-talyx browser screenshot --path /tmp/talyx-verify/evidence/settings-engine/after.png`.
- **Real engine (optional, read-only).** On a `control-talyx launch` run, open the page the same way. It shows "Attached", "Version …" and "Runs …". Open `Debug console`. The connection state reads `open`, and the combobox `Profile` defaults to `default`. Run `control-talyx browser click --role button --name "Drop socket"`. The state leaves `open` and comes back. Run `control-talyx browser click --role button --name "Clear" --exact`. The log reads "Events appear here.". Save the same proof files with the suffix `-engine`.
- **Restore.** Run `control-talyx browser click --role button --name "Debug console" --exact` to close the panel. Nothing is stored in `settings.json` unless Choose file was used.

## Gotchas

- `Choose file` (`engine:pick-path`) opens a native macOS open panel that CDP cannot drive. Do not click it. Report it as not drivable.
- Name not from i18n: the button Send "ping" (`engine.debugPing`) has double quotes inside its name, so a quoted name flag cannot carry it. Find it in the snapshot by its text.
- Send "ping" creates a real session in the user's profile and sends a prompt to that profile's model. Never press it without the user's approval, and never on a profile other than the approved one. It has no "Verify scratch" equivalent.
- `Debug console` needs `--exact`: the sidebar row "Engine Where it runs, debug console" also matches it, comes first, and the click lands on the row (proven 2026-11-18).
- Without `--exact`, `Clear`, `Check again` and `Settings` can match longer names (`Close Settings`). With the engine missing, `Install the engine`, `Choose file` and `Try again` appear twice: on the page and in the console's gate.
- The sidebar row's name is "Engine" plus its detail line, so with `--exact` the name "Engine" does not match the row. Match on the detail text, or on "Engine" without `--exact`.
- `Install the engine` goes to the Agents page and starts the install, which fetches steps from the release page (network). Do not use it as proof for this page.
- The `Agents` block (Copy the add line) renders only after the MCP connection loads. It may be missing for a moment.
- The page heading for screen readers is "Settings: Engine", built in code from two strings. Assert it from the snapshot, not with a name flag.
- No-engine steps proven 2026-11-18 (Check again, Debug console with the gate inside). The console's live controls and Send "ping" are written from the code; confirm roles from a snapshot.
