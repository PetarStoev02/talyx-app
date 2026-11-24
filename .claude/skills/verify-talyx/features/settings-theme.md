# Theme

Settings, General, Appearance lets a user pick Light, Dark or System. The pick repaints the window
at once and is stored in `settings.json`, so it holds on the next start.

## Sub-features

- `theme-open` reaches the Appearance section from the sidebar footer or the shortcut.
- `theme-pick` presses one of Light, Dark, System; the pressed one is marked.
- `theme-persist` stores the pick as `theme` in `settings.json`.

## How to get to it (user POV)

- Choose the `Settings` button in the sidebar footer, then `General` in the Settings pages.
- Press `Meta+Comma` anywhere. Settings opens on the last page.

## Driving it with control-talyx

Preconditions:

- Launch with the engine: without one the engine gate fills the window and there is no sidebar, so no Settings. Do first-run setup in an isolated run first ([First-run setup](./first-run-setup.md)), or attach the real engine (`launch --real-engine`) and only look.
- `control-talyx settings` has no `theme` key, or `"theme": "system"`.

- **Open Settings.** Choose `Settings`. Run `control-talyx browser click --role button --name "Settings" --exact`. The heading `Settings: General` shows, and under `Appearance` a group `Theme` with buttons `Light`, `Dark`, `System [pressed]`.
- **Before.** Run `control-talyx browser screenshot --path /tmp/talyx-verify/evidence/settings-theme/before.png`.
- **Pick Dark.** Choose `Dark`. Run `control-talyx browser click --role button --name "Dark" --exact`. The window turns dark.
- **End state.** Run `control-talyx browser snapshot --path /tmp/talyx-verify/evidence/settings-theme/after.aria.txt`. The file has `button "Dark" [pressed]` and `button "System"` without `[pressed]`.
- **Proof.** Run `control-talyx browser screenshot --path /tmp/talyx-verify/evidence/settings-theme/after.png` and `control-talyx settings > /tmp/talyx-verify/evidence/settings-theme/settings.json`. The JSON has `"theme": "dark"`.
- **Restore.** Choose `System`. Run `control-talyx browser click --role button --name "System" --exact`. `control-talyx settings` shows `"theme": "system"`.

## Gotchas

- `--name "Settings"` without `--exact` also matches `Close Settings` once Settings is open.
- `settings.json` does not exist until the first write; `control-talyx settings` fails before the
  first pick. The seed file counts as a write.
- The `Startup` section (launch at login) is in the code but was not in the snapshot of this
  dev run on macOS; do not assert it here.
- Right after `launch` the dev renderer can reload once; if a click times out, snapshot again
  before retrying, do not loosen the assertion.
