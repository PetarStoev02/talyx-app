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

- Launch with `control-talyx launch` (real engine; no `--no-engine`). The user approved a scratch
  bot. The roster is visible (`control-talyx browser wait --role navigation --name "Roster"` or the
  first bot row).
- No bot named `Verify scratch` exists.

- **Open dialog.** Choose the add button, then `New bot`. Run `control-talyx browser click --role button --name "Add a bot, a room or a folder"` and `control-talyx browser click --role menuitem --name "New bot"`. A dialog `New bot` appears with textbox `Name` focused.
- **Fill.** Run `control-talyx browser fill --role textbox --name "Name" --value "Verify scratch"` and `control-talyx browser fill --role textbox --name "What it does" --value "Verification run; delete me"`. The `Create bot` button is enabled.
- **Model.** Open the model control labelled `Model` and pick `claude-haiku-4-5` (the only model scratch bots run on).
- **Submit.** Choose `Create bot`. Run `control-talyx browser click --role button --name "Create bot"`. The dialog closes and a roster row `Verify scratch` is selected; the chat shows `Message Verify scratch`.
- **Proof.** Run `control-talyx browser snapshot --path /tmp/talyx-verify/evidence/create-bot/after.aria.txt` and `control-talyx browser screenshot --path /tmp/talyx-verify/evidence/create-bot/after.png`. Second view: `talyx-engine` lists the new profile, or the row is still there after `control-talyx browser press --key Meta+R`.
- **Cleanup.** Open the row's menu, choose `Delete bot`, confirm in `Delete Verify scratch?`. The row is gone and the engine no longer lists it.

## Gotchas

- Unverified by this skill so far: this recipe is written from the code (2026-11-17), not from a
  run. Confirm the role of the `New bot` entry (`menuitem` or `button`) from a snapshot first.
- The real engine is the user's. Never run this without approval, never pick a model other than
  `claude-haiku-4-5`, always delete the bot in cleanup.
- `Create bot` stays disabled until `Name` is non-empty; `fill` with an empty value proves the
  disabled state, not a bug.
- The first-run `First bot` step uses the same form inline; its button is `Make bot`.
