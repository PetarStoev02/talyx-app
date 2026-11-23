# Chat search

In a bot's chat (or a room), the user presses `Meta+F` or chooses the search button on the name pill's line (`Search <bot>’s chat and rooms`; in a room, `Search this chat`). A rounded field opens there with the placeholder `Search messages`. It shows `Loading…` while the whole history loads. Then it highlights every match in the transcript and shows a count such as `1 of 2`, or `No matches`. Under the field, a list `Messages found` groups the hits by place: `This chat` first, then the bot's group chats. Each hit is a one-line snippet starting with `You:` or the sender's name. Picking a hit jumps to it. `Previous match` and `Next match` (or Enter and Shift+Enter) step through the matches. Escape closes the list first and the search second, and `Close search` ends it.

## Sub-features

- `search-open`: the search button or `Meta+F` opens the field in place of the button, with focus already in it. Pressing `Meta+F` again while it is open selects the field's text.
- `search-count`: the status shows `Loading…`, then `{current} of {total}` or `No matches`. Matches are painted with the CSS Highlight API, not with markup.
- `search-step`: `Previous match` and `Next match` (disabled with no matches), Enter and Shift+Enter. Stepping closes the list.
- `search-results`: the listbox `Messages found` has one group per place (`This chat`, other chats by name) and option rows. Notes under the list: `Reading the rooms…`, the rooms-failed line, `Showing the newest {count} in each chat.`
- `search-jump`: picking a row (click, or Down then Enter) moves the highlight to that message. A row from another place opens that chat or room with the same search.
- `search-close`: Escape (list first, then search) or `Close search`. Focus goes back to the composer, and the chat returns to its newest part.

## How to get to it (user POV)

- Select a bot in the roster. On the header line with its name pill, choose the magnifier button `Search <name>’s chat and rooms`.
- Press `Meta+F` anywhere in a bot's chat or a room, as long as no dialog is open.

## Driving it with control-talyx

Preconditions:

- Engine-backed. Launch with `control-talyx launch` (real engine). It is not reachable with `--no-engine`, because the engine gate has no chat and no search slot.
- The scratch bot `Verify scratch` exists (see create-bot), and its chat has the chat-send exchange containing `pong`. Never search the user's own bots' chats in a recipe.
- Select it: run `control-talyx browser click --role button --name "Verify scratch"`.

- **Open.** Choose the search button. Run `control-talyx browser click --role button --name "Search Verify scratch’s chat and rooms"`. A `search` landmark appears with a combobox of the same name, plus the buttons `Previous match`, `Next match` and `Close search`.
- **Type.** Run `control-talyx browser fill --role combobox --name "Search Verify scratch’s chat and rooms" --value "pong"`. Then run `control-talyx browser wait --role listbox --name "Messages found"`. The status reads `1 of 2` (or more), and the list has the group `This chat` with option rows `You: ...pong...` and the reply.
- **Jump.** Run `control-talyx browser press --key ArrowDown` and then `control-talyx browser press --key Enter`. The list closes, the current-match highlight is on that message, and the count shows its index.
- **Step.** Choose `Next match`. Run `control-talyx browser click --role button --name "Next match"`. The count advances and wraps after the last match.
- **Proof.** Run `control-talyx browser snapshot --path /tmp/talyx-verify/evidence/chat-search/after.aria.txt` and `control-talyx browser screenshot --path /tmp/talyx-verify/evidence/chat-search/after.png`. The snapshot has the combobox, a status `N of M`, and `button "Next match"` enabled. The screenshot shows the highlighted words.
- **Close.** Choose `Close search`. Run `control-talyx browser click --role button --name "Close search"`. The field is gone, the search button is back, and focus is in `Message Verify scratch`. Nothing was stored, so there is nothing to restore. The scratch bot's cleanup is in create-bot.

## Gotchas

- The open button's name uses a typographic apostrophe (U+2019), as in `Verify scratch’s`, not `'`. A straight quote will not match.
- In a room, the button and the field are both named `Search this chat`, and the room's search lists only that room.
- The field is an `input type="search"` with `role="combobox"`, so select it with `--role combobox`, not textbox.
- The count is a `role="status"` span; the snapshot prints its text (`status: 1 of 2`). Assert it from the snapshot; do not wait on it by name.
- Option rows are named by message text, which is not app copy (none of their names come from i18n). Reach them with ArrowDown and Enter, or read them from the snapshot.
- While the bot's group chats load, the note `Reading the rooms…` shows and the list can grow. Snapshot again before asserting the hit count.
- `Meta+F` does nothing while a dialog or menu is open (`layerOpen()`). The button is the clickable path to prove.
- Real-engine rules apply: search only the approved scratch bot, and create nothing else.
- Proven 2026-11-18 on the scratch bot: open, type `pong` (`status: 1 of 2`, `group "This chat"` with `option "pong"` first and `option "You: Reply with the single word pong."` second), `Next match` (`2 of 2`), `Close search`. Jumping and room search are written from the code.
