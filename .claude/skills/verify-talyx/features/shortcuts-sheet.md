# Keyboard shortcuts

Pressing ⌘/ (Ctrl+/ on Linux) anywhere in the app outside first-run setup opens a "Keyboard shortcuts" dialog. It lists every shortcut Talyx has in three groups. "Bots and rooms" has New bot, Previous bot or room, Next bot or room, Search this chat, Pick a row or unpick it and Pick a range of rows. "Composer" has Go to the message box, Send and New line. "App" has Open a page from the dock, Open or close Settings, Close Settings or Usage, or clear the picked rows, and Show these shortcuts. Each row shows its keys as small key caps, written the platform's way (⌥⇧⌘ on macOS, Ctrl+Alt+Shift on Linux). Esc, the Close button, a click outside the dialog or ⌘/ again closes it.

## Sub-features

- `shortcuts-open` opens the sheet with ⌘/ (Ctrl+/ on Linux). There is no button for it.
- `shortcuts-groups` shows the three group headings and their rows from the same list the keys are bound from, so the sheet cannot drift from the real bindings.
- `shortcuts-keys` shows key caps per row in the platform's order and names (↑, ↓, Esc, ⌘ or Ctrl, `1-9`, `Click`).
- `shortcuts-close` closes the sheet with Esc, the Close button, a click outside it or ⌘/ again.

## How to get to it (user POV)

- Press `Meta+Slash` on any page of the app (Agents, the engine gate, Settings, Usage).
- It does nothing during first-run setup, and nothing while another dialog is open.

## Driving it with control-talyx

Preconditions:

- Baseline launch (`--no-engine`, seed `{"setupDone": true}`). The engine gate shows. The shortcut is bound there because setup is not on screen.
- No other dialog is open.

- **Open.** Run `control-talyx browser press --key Meta+Slash`, then `control-talyx browser wait --role dialog --name "Keyboard shortcuts"`. The dialog shows with heading `Keyboard shortcuts`.
- **Groups.** Run `control-talyx browser snapshot`. It shows the headings `Bots and rooms`, `Composer` and `App`, the row texts listed above, and key caps such as `⌘` `/` next to `Show these shortcuts`. Check one of them: `control-talyx browser wait --role heading --name "Bots and rooms"`.
- **Before close.** Run `control-talyx browser screenshot --path /tmp/talyx-verify/evidence/shortcuts-sheet/before.png`.
- **Proof.** Run `control-talyx browser snapshot --path /tmp/talyx-verify/evidence/shortcuts-sheet/after.aria.txt` and `control-talyx browser screenshot --path /tmp/talyx-verify/evidence/shortcuts-sheet/after.png`. The ARIA file has `dialog "Keyboard shortcuts"`, the three group headings and 13 rows.
- **Close with the button.** Run `control-talyx browser click --role button --name "Close" --exact`. The dialog is gone and the engine gate heading `Talyx needs its engine.` shows again.
- **Close with Esc.** Run `control-talyx browser press --key Meta+Slash` to open it again, then `control-talyx browser press --key Escape`. The dialog closes.
- **Toggle.** Run `control-talyx browser press --key Meta+Slash` twice. The sheet opens and then closes. ⌘/ is the one shortcut that still works while a dialog is open, and only to close this sheet.
- **Restore.** Nothing to restore: the sheet writes no settings and leaves the dialog closed.

## Gotchas

- The keyboard is the only way in. There is no button, so `press` is the path to prove here.
- During first-run setup (including after the gate's `Install the engine`) the shortcuts are not bound, and ⌘/ does nothing.
- If any other dialog is open (create bot, approval, activation), ⌘/ is ignored. Close that dialog first.
- Name not from i18n: the dialog's Close button gets its name from a hard-coded sr-only `Close` in `shared/ui/dialog.tsx`. It happens to match the i18n value `action.close`, so `--name "Close"` passes the map test, but use `--exact`, or it also matches `Close Settings` when Settings is open.
- Use `--exact` for the group heading `App` (a substring of other names).
- Rows are a `dl`: the snapshot prints each as `term: <label>` and `definition: <keys>` (for example `term: Show these shortcuts`, `definition: ⌘ /`).
- Key caps depend on `navigator.platform`. On macOS they read `⌘`, `⌥`, `⇧`. On Linux they read `Ctrl`, `Alt`, `Shift`.
- Right after `launch` the app shows a splash until it knows whether the engine is there. Wait for the gate heading before pressing.
- Proven 2026-11-18 with `--no-engine`: open, 13 rows, Close, Escape and the Meta+Slash toggle.
