# Rooms

A room is a group chat hosted by the engine. From the roster's add button the user picks `New room`, gives it a `Name` and picks 2 to 6 `Bots`. The room then shows up as a roster row ("2 bots") and opens on its own page: "Say something to the room. Each bot answers in turn.", with the composer `Message the room · @ to address one bot`. While bots reply, a line under the transcript reads "Answering: {names}" and "Up next: {names}". The room's pill opens `Room details`, where the user can rename the room, `Add a bot`, use `View bot` or `Remove from room` on a member, and `Delete room`. Right-clicking the row gives `Pin` / `Unpin`, `Move to` and `Delete room`. Deleting a room stops it on every machine. Its bots and their own chats stay.

## Sub-features

- `rooms-create`: the `New room` dialog with `Name`, the `Bots` checkboxes ("{count} of 6 picked"), `Folder`, and `Create room` (stays disabled until there is a name and 2 to 6 bots are picked).
- `rooms-transcript`: the empty state (room name heading, members, `Ways to start`), then the room's log, with "{name} joined" / "{name} left" lines.
- `rooms-send`: the composer sends to the room, and each member answers in turn.
- `rooms-answering`: the status line "Answering: {names}" / "Up next: {names}" and the speaking avatars on the pill.
- `rooms-members`: `Room details` lists the `Bots`. `Add a bot` seats a bot (up to 6). `Remove from room` works only while more than 2 bots are in the room.
- `rooms-rename`: the pencil `Rename room`, then the `Name` field and `Save`.
- `rooms-pin`: the row's menu `Pin` puts the room as a tile next to the pinned bots, and `Unpin` takes it back.
- `rooms-delete`: `Delete room` (row menu or details footer), then the dialog "Delete {name}?" with `Delete room` / `Cancel`.

## How to get to it (user POV)

- Sidebar `Add a bot, a room or a folder`, then `New room`.
- Choose a room's row in the roster to open its page. Choose the pill `Details for {name}` for `Room details`.
- Right-click a room's row (or focus it and press Shift+F10) for `Pin`, `Move to` and `Delete room`.

## Driving it with control-talyx

Preconditions:

- Engine-backed: run `control-talyx launch` (real engine, no `--no-engine`). With `--no-engine` only the engine gate shows.
- A room needs 2 bots, and the user's own bots must never be seated. The user must approve two scratch bots: `Verify scratch` and a second one, `Verify scratch 2`. Make both with the create-bot recipe on `claude-haiku-4-5`. The second one is filled with `control-talyx browser fill --role textbox --name "Name" --value "Verify scratch 2"`.
- No room named `Verify room` exists.

- **Open dialog.** Run `control-talyx browser click --role button --name "Add a bot, a room or a folder"`, then `control-talyx browser click --role menuitem --name "New room"`. A dialog `New room` appears with "Pick 2 to 6 bots." and "0 of 6 picked".
- **Fill.** Run `control-talyx browser fill --role textbox --name "Name" --value "Verify room"`, `control-talyx browser click --role checkbox --name "Verify scratch" --exact` and `control-talyx browser click --role checkbox --name "Verify scratch 2"`. The counter reads "2 of 6 picked" and `Create room` is enabled.
- **Create.** Run `control-talyx browser click --role button --name "Create room"`. The dialog closes and the row `Verify room` ("2 bots") is selected. The page heading is `Verify room`, with "Say something to the room. Each bot answers in turn."
- **Send.** Run `control-talyx browser fill --role textbox --name "Message the room · @ to address one bot" --value "Verify run: reply with one word"`, then `control-talyx browser click --role button --name "Send" --exact`. The message appears in the transcript. The status line reads "Answering: Verify scratch" (or the other bot), then each bot's reply arrives in turn.
- **Members.** Run `control-talyx browser click --role button --name "Details for Verify room"`. The panel `Room details` lists both bots. Run `control-talyx browser click --role button --name "Actions for Verify scratch 2"`. In the menu, `View bot` is enabled and `Remove from room` is disabled (2 is the minimum). Close it with `control-talyx browser press --key Escape`.
- **Pin.** Run `control-talyx browser click --role button --name "Verify room"`, then `control-talyx browser press --key Shift+F10`, then `control-talyx browser click --role menuitem --name "Pin" --exact`. The room moves to the tiles at the top of the roster. Pressing Shift+F10 on it again now offers `Unpin`.
- **Proof.** Run `control-talyx browser snapshot --path /tmp/talyx-verify/evidence/rooms/after.aria.txt` and `control-talyx browser screenshot --path /tmp/talyx-verify/evidence/rooms/after.png`. Second view: run `control-talyx browser press --key Meta+R`, then check that the room is still pinned and that its transcript still shows the message and the replies.
- **Cleanup.** Open `Details for Verify room`, then run `control-talyx browser click --role button --name "Delete room"`. A dialog `Delete Verify room?` appears. Confirm with `control-talyx browser click --role button --name "Delete room"` (the dialog is modal, so this is the only match). The row is gone. Then delete both scratch bots as in the create-bot cleanup.

## Gotchas

- Real engine only. Every room needs at least 2 bots, so the single `Verify scratch` bot is not enough. Get approval for the second scratch bot before running. Never pick the user's bots, Talyx's own bot included, as members, and never send to a room that has them.
- `Add a bot` lists every other unhidden bot, and those are the user's. Do not click one. Proving add or remove needs a third approved scratch bot.
- The room's row and tile have no menu button. Their actions open only on right-click, the ContextMenu key or Shift+F10 on the focused row (`RoomRow.tsx`).
- The pill name `Details for {name}` is the same text for a bot and for a room, and "Delete room" appears in three places (row menu, details footer, dialog). Snapshot before clicking whenever more than one could be visible.
- Replies depend on the network and the model provider. Wait on the transcript, and do not treat a slow "Answering:" as a failure. If the app shows "The engine is not running rooms right now..." (read-only, no composer), it is the engine's room plugin that is down, not the room.
- `Send` becomes `Send after this answer` while bots are answering. `Send` without `--exact` still matches either one.
- Written from the code (2026-11-18); confirm roles from a snapshot.
