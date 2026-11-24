# Bot details

When a user chooses the name pill at the top of a bot's chat, the `Bot details` panel opens beside the chat. It shows the bot's avatar, its title, what it does and its model. Four tabs sit below that: `Details` (Title, Description, Model, then the bot's Routines), `Look` (Shape, Color, Match the name, Show a face), `Soul` (the `SOUL.md` text) and `Memory` (Memories and Skills, each with its own search). Edits on Details, Look and Soul wait for `Save`, which closes the panel. `Cancel` throws them away. The Memory tab saves each change at once and has no footer. The engine owns everything the panel shows.

## Sub-features

- `details-open` opens the panel from the pill `Details for <bot>`, from the roster row's `Edit bot`, or from `Add a description` in an empty chat. Choosing the pill again closes it, and so does `Close details`.
- `details-edit` covers Title, Description and Model on `Details`. `Save` stays disabled until something changes.
- `details-model-confirm` shows the dialog `Use this model?` with `Use this model` and `Keep current model` when the engine asks before it switches.
- `details-routines` lists routines (`Open <name>`, the switch `Run <name>`, `Delete <name>`) and has `New routine`.
- `details-look` has the shape buttons (Cube, Tall, Slab, Stair, Twin), `Color <n>`, `Match the name` and the switch `Show a face`. Talyx itself shows only the logo note.
- `details-soul` is the `SOUL.md` textbox.
- `details-memory` has the tabs `Memories` and `Skills <n>`, `Search memories` and `Search skills`, `Edit memory: <text>` and `Delete memory: <text>`, and the switch `Use <skill>`.

## How to get to it (user POV)

- Select a bot in the roster, then choose the pill `Details for <bot>` in the chat header.
- Open the roster row's context menu and choose `Edit bot`.
- In a bot's empty chat with no description, choose `Add a description`.

## Driving it with control-talyx

Preconditions:

- Run `control-talyx launch --real-engine`. In an isolated run the engine gate shows, the roster has no bots, and this panel cannot be reached.
- The bot `Verify scratch` exists from create-bot, made with approval. Never open the panel on the user's own bots in order to edit them.

- **Select the bot.** Run `control-talyx browser click --role button --name "Verify scratch"`. The pill `Details for Verify scratch` shows in the chat header.
- **Open.** Run `control-talyx browser click --role button --name "Details for Verify scratch"`. The complementary region `Bot details` appears, with the tablist `Bot sections` and the tab `Details` selected. Wait until `Loading details…` is gone.
- **Edit description.** Run `control-talyx browser fill --role textbox --name "Description" --value "Verify details edit"`. The button `Save` is now enabled.
- **Look tab (view only).** Run `control-talyx browser click --role tab --name "Look" --exact`. The buttons `Cube`, `Tall` and `Match the name` and the switch `Show a face` show. Change nothing here.
- **Save.** Run `control-talyx browser click --role button --name "Save" --exact`. The panel closes. The pill takes focus again, and the empty chat shows `Verify details edit` under the bot's title.
- **Second view.** Run `control-talyx browser press --key Meta+R`, select the bot again, and reopen the panel. The textbox `Description` holds `Verify details edit`.
- **Memory (view only).** Run `control-talyx browser click --role tab --name "Memory" --exact`. The tablist `Memories and skills` and the searchbox `Search memories` appear.
- **Proof.** Run `control-talyx browser snapshot --path /tmp/talyx-verify/evidence/bot-details/after.aria.txt` and `control-talyx browser screenshot --path /tmp/talyx-verify/evidence/bot-details/after.png`.
- **Cleanup.** Run `control-talyx browser click --role button --name "Close details"`. Then delete `Verify scratch` as in create-bot's Cleanup.

## Gotchas

- This feature needs the real engine. It is the user's engine, so change only `Verify scratch`. Never change Model, SOUL, routines, memories or skills on any bot without approval. A scratch bot stays on `claude-haiku-4-5`.
- Name not from i18n (Model field trigger, `src/renderer/src/shared/ui/ModelPicker.tsx:166`). The code joins the label to the shown model as "Model: " plus the model, so pick the trigger from a snapshot.
- `Save` and `Cancel` also show in the memory and skill dialogs, so use `--exact` and act only while the panel footer shows.
- A Memory tab name carries a count (for example "Skills 58"), so match it without `--exact`.
- The bot `default` has no Title field. Talyx's Look tab shows only "Talyx is always the logo, in black and white."
- A model change can open the dialog `Use this model?`. Choose `Keep current model` unless the change was approved.
- When the window is narrow, the panel lies over the chat, and Meta+F closes it.
- Proven 2026-11-18 on the scratch bot: open (`complementary "Bot details"`, `tablist "Bot sections"` with `tab "Details" [selected]`), Description edit and `Save`, the value read back on reopen, the Memory tab (`tab "Memories 0"`, `tab "Skills 43"`, `searchbox "Search memories"`). Look, Soul and routines are written from the code.
- The description shows under the title only in an empty chat; once the chat has messages, prove the save by reopening the panel.
