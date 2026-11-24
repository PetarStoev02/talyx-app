# Create a bot

From the roster's add button a user makes a new bot: a name, what it does, a look, a folder and a
model. The bot appears as a row in the roster and opens its empty chat. The engine owns the bot;
Talyx shows it.

## Sub-features

- `create-open` opens the `New bot` dialog from the roster's add button or `Meta+N`.
- `create-fill` takes `Name` and `What it does`; `Create bot` enables once a name is given.
- `create-submit` makes the bot in the engine and selects its row.
- `create-cancel` closes the dialog with nothing made.

## How to get to it (user POV)

- Choose the sidebar button `Add a bot, a room or a folder`, then `New bot`.
- Press `Meta+N` while a chat is open.
- The first-run flow's `First bot` step (same form, no dialog).

## Driving it with control-talyx

Preconditions:

- Launch with `control-talyx launch --real-engine`. The user approved a scratch
  bot. The roster is visible (`control-talyx browser wait --role navigation --name "Roster"` or the
  first bot row).
- No bot named `Verify scratch` exists.

- **Open dialog.** Choose the add button, then `New bot`. Run `control-talyx browser click --role button --name "Add a bot, a room or a folder"`; a `menu` with `menuitem "New bot"`, `menuitem "New room"`, `menuitem "New folder"` opens. Run `control-talyx browser click --role menuitem --name "New bot"`. A `dialog "New bot"` appears with `textbox "Name"`, `textbox "What it does"`, `combobox "Folder"`, the model button, the `Shape` and `Color` groups and `button "Create bot" [disabled]`.
- **Folder.** The `Folder` select defaults to the selected bot's folder (`Unassigned` when none), which can be one of the user's folders; always pick `Unassigned`. Run `control-talyx browser select --role combobox --name "Folder" --value "Unassigned"`.
- **Fill.** Run `control-talyx browser fill --role textbox --name "Name" --value "Verify scratch"` and `control-talyx browser fill --role textbox --name "What it does" --value "Verification run; delete me"`. The name field's accessible name becomes `Name ID: verify-scratch` and `Create bot` is enabled.
- **Model.** Click the model button (named `Model: Engine default` before a pick; the name is built in `ModelPicker.tsx`, read it from the snapshot). A `menu` of `menuitemcheckbox` rows opens, one per model the engine offers. Click the row for claude-haiku-4-5 (on 2026-11-18 its name was the dated id `claude-haiku-4-5-20251001`; model names come from the engine, so read it from the snapshot). The button then reads `Model: anthropic · claude-haiku-4-5-20251001`.
- **Submit.** Run `control-talyx browser click --role button --name "Create bot"`. The dialog closes. Under `region "Unassigned"` a row `button "Verify scratch No messages yet"` appears, and `main` has `region "Chat with Verify scratch"` with `heading "Verify scratch"`, the description, the model line and `textbox "Message Verify scratch"`.
- **Proof.** Run `control-talyx browser snapshot --path /tmp/talyx-verify/evidence/create-bot/after.aria.txt` and `control-talyx browser screenshot --path /tmp/talyx-verify/evidence/create-bot/after.png`. Second view: `talyx-engine profile list` has a row `verify-scratch` with model `claude-haiku-4-5-20251001`; save it as `engine-profiles.txt`.
- **Cleanup.** Focus the row (`control-talyx browser click --role button --name "Verify scratch"`), run `control-talyx browser press --key Shift+F10`; a `menu` with `Pin`, `Move up`, `Move to`, `Edit bot`, `Delete bot` opens. Run `control-talyx browser click --role menuitem --name "Delete bot"`. In `dialog "Delete Verify scratch?"` run `control-talyx browser click --role button --name "Delete bot" --exact`. The row is gone and `talyx-engine profile list` no longer lists `verify-scratch`.

## Gotchas

- Proven 2026-11-18 against the real engine with an approved scratch bot (create, engine listing,
  delete). The roles above are from that run's snapshot.
- Bot rows have no menu button: their menu opens on right-click or Shift+F10 on the focused row.
- With the real engine, the chat that opens first is the last selected one (often Talyx). Never
  type into it.
- The real engine is the user's. Never run this without approval, never pick a model other than
  `claude-haiku-4-5`, always delete the bot in cleanup.
- `Create bot` stays disabled until `Name` is non-empty; `fill` with an empty value proves the
  disabled state, not a bug.
- The first-run `First bot` step uses the same form inline; its button is `Make bot`.
