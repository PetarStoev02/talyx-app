# Layout

Settings, General, Appearance lets a user pick the sidebar layout: Dock (the pages in a dock at the
foot of the sidebar) or Layered (the pages in a rail beside the sidebar, the page as a card). The pick
redraws the window at once and is stored in `settings.json`, so it holds on the next start.

## Sub-features

- `layout-pick` presses Dock or Layered; the pressed one is marked.
- `layout-persist` stores the pick as `sidebarLayout` in `settings.json`.

## How to get to it (user POV)

- Choose the `Settings` button (the sidebar footer in Dock, the rail's foot in Layered), then
  `General` in the Settings pages.
- Press `Meta+Comma` anywhere. Settings opens on the last page.

## Driving it with control-talyx

Preconditions:

- Launch with the engine (`launch --real-engine`, only look) or after first-run setup in an isolated run: without one there is no sidebar, so no Settings.
- `control-talyx settings` has no `sidebarLayout` key, or `"sidebarLayout": "dock"`.

- **Open Settings.** Choose `Settings`. Run `control-talyx browser click --role button --name "Settings" --exact`. Under `Appearance` a group `Layout` has buttons `Dock [pressed]` and `Layered`.
- **Pick Layered.** Choose `Layered`. Run `control-talyx browser click --role button --name "Layered" --exact`. The pages move to a rail at the window's left edge and the page becomes a rounded card.
- **End state.** Run `control-talyx browser snapshot --path /tmp/talyx-verify/evidence/settings-layout/after.aria.txt`. The file has `button "Layered" [pressed]`.
- **Proof.** Run `control-talyx browser screenshot --path /tmp/talyx-verify/evidence/settings-layout/after.png` and `control-talyx settings > /tmp/talyx-verify/evidence/settings-layout/settings.json`. The JSON has `"sidebarLayout": "layered"`.
- **Restore.** Choose `Dock`. Run `control-talyx browser click --role button --name "Dock" --exact`. `control-talyx settings` shows `"sidebarLayout": "dock"`.

## Gotchas

- `--name "Settings"` without `--exact` also matches `Close Settings` once Settings is open.
- Below a 900px window the Layered panel starts folded; `Show sidebar` at the rail's foot opens it.
