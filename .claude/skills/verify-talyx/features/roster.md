# Roster organisation

The roster in the sidebar (`Roster`) lists the user's bots and rooms. Pinned ones sit at the top as tiles, and the rest sit in folders, with `Unassigned` last. Each folder header shows the folder's name and a count, and a click folds it open or closed. The `+` button (`Add a bot, a room or a folder`) offers `New folder`. A folder's `...` button (`Actions for folder {name}`) offers `New folder`, `Rename folder` and `Delete folder`. Right-clicking a bot row opens `Pin` or `Unpin`, `Move pin earlier`/`Move pin later`, `Move up`/`Move down`, `Move to` (every folder, then `Unassigned`), `Edit bot` and `Delete bot`. A row shows a dot for an unread reply or a bot waiting on the user. A pinned tile reads `Ready`, `Working`, `Needs you` or `Unread reply`. Shift-click or Cmd-click picks several rows. The live line then reads `{count} selected`, and a right-click on a picked row acts on all of them: `Move to`, `Pin`/`Unpin`, `Mark as read`, `Hide` (bots only), `Delete...`. Hidden bots collect under `Hidden bots ({count})`, and `Show {name}` brings one back.

## Sub-features

- `roster-folder-create` makes a folder from the `+` menu's `New folder` or from a folder's `New folder` (`New folder in {name}`).
- `roster-folder-rename` renames a folder from its menu's `Rename folder`.
- `roster-folder-delete` deletes a folder (`Delete {name}?`). Its bots move to `Unassigned` or to the parent folder, and no bot is deleted.
- `roster-folder-collapse` folds a folder open or closed from its header button (`aria-expanded`). This lives only in the page and is not stored.
- `roster-move` puts a bot or room in a folder with `Move to`, reorders it with `Move up`/`Move down`, or does both by dragging.
- `roster-pin` pins or unpins a bot or room, moving it between the tiles and its folder. `Move pin earlier`/`Move pin later` reorder the tiles.
- `roster-hide` hides bots (bulk menu only) and restores them with `Show {name}` under `Hidden bots ({count})`.
- `roster-marks` shows unread and activity marks: the dot, the tile status words, and `Mark as read` in the bulk menu.
- `roster-bulk` picks rows with Shift or Cmd clicks. It shows `{count} selected`, offers the bulk menu and `Delete {count} items?`, and Escape clears the picks.

## How to get to it (user POV)

- The sidebar of the Agents page, once Talyx is attached to the engine. Folders come from the `+` button at the top of the sidebar.
- Right-click a bot row (or focus it and press Shift+F10) for its actions. Click a folder's `...` for folder actions.
- Shift-click or Cmd-click rows to pick several, then right-click one of the picked rows.

## Driving it with control-talyx

Preconditions:

- Launch with `control-talyx launch` (the real engine, no `--no-engine`). The roster only renders when the engine is attached. The bot `Verify scratch` exists (see create-bot.md) and is not pinned. Folder steps need the user's approval for one folder named `Verify folder`.

- **Roster shows.** Run `control-talyx browser wait --role navigation --name "Roster"`. The snapshot has a region `Unassigned` with button `Unassigned` and a button containing `Verify scratch`.
- **Collapse.** Run `control-talyx browser click --role button --name "Unassigned" --exact`. The button shows `[expanded=false]` and its rows leave the snapshot. Click it again to reopen.
- **Pin.** Focus the row with `control-talyx browser click --role button --name "Verify scratch"`, then run `control-talyx browser press --key Shift+F10` and `control-talyx browser click --role menuitem --name "Pin" --exact`. The bot leaves `Unassigned` and shows as a tile reading `Ready`.
- **Unpin.** Repeat Shift+F10 on the tile and run `control-talyx browser click --role menuitem --name "Unpin" --exact`. The bot is back in its folder.
- **New folder (approved only).** Run `control-talyx browser click --role button --name "Add a bot, a room or a folder"` and `control-talyx browser click --role menuitem --name "New folder"`. In the dialog `New folder`, run `control-talyx browser fill --role textbox --name "Name" --value "Verify folder"` and `control-talyx browser click --role button --name "Create folder"`. A region `Verify folder` appears with the button `New bot` and the hint `Or drag a bot or room here.`
- **Move in.** On the `Verify scratch` row, press Shift+F10, then run `control-talyx browser click --role menuitem --name "Move to"` and `control-talyx browser click --role menuitem --name "Verify folder"`. The row now sits under that folder and its count reads 1.
- **Rename.** Run `control-talyx browser click --role button --name "Actions for folder Verify folder"`, then `control-talyx browser click --role menuitem --name "Rename folder"`, then `control-talyx browser fill --role textbox --name "Name" --value "Verify renamed folder"` and `control-talyx browser click --role button --name "Rename folder"`. The region is now `Verify renamed folder`.
- **Proof.** Run `control-talyx browser snapshot --path /tmp/talyx-verify/evidence/roster/after.aria.txt` and `control-talyx browser screenshot --path /tmp/talyx-verify/evidence/roster/after.png`. Second view: run `control-talyx browser click --role button --name "Refresh roster"` (or `control-talyx browser press --key Meta+R`) and check the folder and the row's place survive the reload.
- **Cleanup.** Run `control-talyx browser click --role button --name "Actions for folder Verify renamed folder"`, then `control-talyx browser click --role menuitem --name "Delete folder"`. In the dialog `Delete Verify renamed folder?`, run `control-talyx browser click --role button --name "Delete folder"`. `Verify scratch` goes back to `Unassigned`. Delete the scratch bot as create-bot.md says.

## Gotchas

- Engine-backed: with `--no-engine` the roster (`useRosterBackend` returns null) and the `+` button are not rendered. Only the scratch bot, plus an approved scratch folder, may be touched. Never pin, move, hide or mark the user's own bots or folders. Folders, order and room pins are the engine's shared layout and other clients see them.
- Bot rows have no menu button. Their actions are a context menu, and control-talyx has no right-click, so use focus plus `press --key Shift+F10`. If the click moved focus to the composer, Shift+F10 opens nothing, so snapshot and refocus the row.
- Bulk picks (`roster-bulk`, `roster-hide`, `Mark as read`, `Delete...`) need Shift-click or Cmd-click. control-talyx `click` takes no modifiers, so report them as not drivable. `Hide` exists only in the bulk menu (2+ picked bots), so hiding is not drivable either.
- Accessible names match substrings case-insensitively: `Pin` also matches `Unpin` and `Move pin earlier`, `Unassigned` matches the `Move to` submenu entry (a menuitem, different role), and `New folder` is both a menuitem and a dialog title. Use `--exact` and the role.
- The folder header button's name is the folder name plus its count (e.g. `Unassigned 3`), so `--exact` on just the name may fail. Confirm from a snapshot and drop `--exact` there if needed.
- The pick state is announced in a `status` line and `aria-description` (`Selected`, `Unread reply`, `Working`, `Needs you`). The ARIA snapshot may not print descriptions, so read the tile text or the screenshot instead.
- The `Hidden bots ({count})` toggle is a native `details`/`summary`. Its role in the snapshot is uncertain, so check it before driving.
- The `Delete bot` entry is disabled for the profile `default`. Talyx's own bot cannot be hidden or deleted.
- Proven 2026-11-18 in a `--no-engine` run whose engine was installed by setup (no user data): pin (the tile reads `Ready`), unpin, New folder, Move to, Rename folder, Delete folder (the bot goes back to `Unassigned`). A folder named with the bot's name as a prefix (`Verify scratch folder`) made `--name "Verify scratch"` hit the folder header first, hence `Verify folder`.
- Seen 2026-11-18: the roster is `navigation "Roster"`, folders are `region` with a header `button "<folder> <count>" [expanded]`, a pinned tile is `button "<name> Ready"`, and a bot row's Shift+F10 menu has `Pin`, `Move up`, `Move to`, `Edit bot`, `Delete bot`. Folder, pin, hide and bulk steps were not driven (they change the user's shared layout); confirm roles from a snapshot.
