# Update button

When a Talyx release or an engine update is waiting, the sidebar footer swaps the roster's refresh button for an update button. The button's name says what it shows: "Update available", "Engine update", "Downloading {percent}%", "Installing the engine update" or "Update downloaded". Hovering or clicking it opens a popover named "Updates", with the engine first. The engine row shows "Engine {version} ready to install" and has "Install the engine". The Talyx row shows "Talyx {version} is available", how old the release is, its highlights and changes, then "Download" and "Later". While it downloads, the row has a progress bar and "Cancel". When the download is done, the row says "Update {version} is ready. Restart Talyx to finish, or it installs when you quit." and has "Restart to update". A failed download shows "Update {version} did not download." with "Try again" and "Open the release page". In Settings, About, "Check for updates" shows "Talyx is up to date." or "Talyx {version} is available.", and when it finds a release it opens the update button's popover.

## Sub-features

- `update-check` Settings, About, "Check for updates" (shows "Checking…") writes its result in a status line.
- `update-notice` a release the check found opens the "Updates" popover and keeps it open until Escape or a click elsewhere.
- `update-download` "Download" fetches the signed release and turns the button into a progress ring; "Cancel" stops it.
- `update-later` "Later" closes the popover; the button stays.
- `update-restart` "Restart to update" installs the downloaded release and restarts Talyx.
- `update-release-page` "Open the release page" shows when Talyx cannot download the release itself (deb, unsigned feed) or a download failed.
- `update-engine` with an attached engine older than the pinned version: "Install the engine" goes to Agents and runs the engine gate's install.

## How to get to it (user POV)

- Wait for a release: a packaged Talyx checks 15 s after start, then hourly, on wake and on focus. The button then shows in the footer's right corner.
- Choose `Settings` in the footer, then `About` in the Settings pages, then `Check for updates`.

## Driving it with control-talyx

Preconditions:

- Launch with the engine: without one the engine gate fills the window and there is no sidebar, so no Settings. Do first-run setup in an isolated run first ([First-run setup](./first-run-setup.md)), or attach the real engine (`launch --real-engine`) and only look. A dev run never checks on a schedule, so the button shows only after the manual check finds a release newer than the package version.
- Network access to github.com.

- **Open About.** Run `control-talyx browser click --role button --name "Settings" --exact`, then `control-talyx browser click --role button --name "About"`. Then run `control-talyx browser wait --role heading --name "About" --exact`. The page shows `Talyx {version}`, "Engine not found" and `button "Check for updates"`.
- **Check.** Run `control-talyx browser click --role button --name "Check for updates"`. The button reads "Checking…" for a moment. The status line then reads "Talyx is up to date.", "Talyx {version} is available." or "Talyx could not check for updates. Check your connection and try again."
- **Notice (only if a release was found).** Run `control-talyx browser wait --role dialog --name "Updates"`. The footer has `button "Update available"`. The dialog has a heading "Talyx {version} is available" and either `button "Download"` with `button "Later"`, or only `button "Open the release page"`.
- **Later.** Run `control-talyx browser click --role button --name "Later" --exact`. The dialog closes and `button "Update available"` stays. To reopen it, run `control-talyx browser click --role button --name "Update available"`.
- **Proof.** After the check (whatever its result) run `control-talyx browser snapshot --path /tmp/talyx-verify/evidence/update-button/after.aria.txt` and `control-talyx browser screenshot --path /tmp/talyx-verify/evidence/update-button/after.png`. Record which result the check gave.
- **Cleanup.** Press Escape with `control-talyx browser press --key Escape`, then run `control-talyx browser click --role button --name "Close Settings"`. Nothing is stored in `settings.json`, and the update state lives in main until `control-talyx stop`.

## Gotchas

- Do not click `Download` or `Restart to update` in a verification run. Download fetches a real signed release, and Restart replaces the running app. Report `update-download` and `update-restart` as not driven unless the user approves.
- Whether a release shows depends on the network and on GitHub's latest release being newer than the dev build's package version (`package.json`). With no newer release, only the "Talyx is up to date." status line is provable, and the button never shows.
- The status line is `role="status"`, which takes no name from its text. Read it from the snapshot; do not wait on it by name.
- `update-engine` needs the real engine attached at a version other than the pinned one. In an isolated run the engine row never shows. Never click `Install the engine` against the user's engine without approval: it runs the real install.
- Hovering opens the popover only for a real mouse pointer. Drive it with clicks: a click pins the popover open.
- The Settings row's name is "About Version, updates, diagnostics" (title plus detail), so match `About` as a substring, not with `--exact`. The page's sr-only h1 is "Settings: About", which is not one i18n value.
- "Open the release page" and the "{count} changes" link open the system browser through the window-open guard. Nothing inside the app changes.
- The button's label for its progress state comes from i18n with the percent filled in, and the popover's progress bar has the same name.
- Partly proven 2026-11-18: `Check for updates` answered `Talyx is up to date.`, so no button or `Updates` popover showed. The popover, Download, Later and Restart are written from the code; confirm roles from a snapshot when a newer release exists.
