# Settings About

Settings, About shows which Talyx is running ("Talyx 1.1.0" in a dev run) and which engine it found ("Engine {version}", or "Engine not found" when there is none). "Check for updates" asks GitHub for the latest release. While it runs the button reads "Checking…", and afterwards a status line reads "Talyx is up to date.", "Talyx {version} is available." or "Talyx could not check for updates. Check your connection and try again." Under the line "For a bug report: the versions, your system and the end of the log. Keys and tokens are left out." the "Copy diagnostics" button puts that report on the clipboard. Its label then reads "Copied." for a moment. If the copy fails, a toast says "Talyx could not copy the diagnostics."

## Sub-features

- `about-open` reaches the About page from the Settings pages sidebar (row "About", detail "Version, updates, diagnostics").
- `about-versions` shows the Talyx version line and the engine line ("Engine {version}" when attached, "Engine not found" when missing, nothing while it is still checking).
- `about-check-updates` runs a release check. It shows "Checking…" and then one of the three status lines. When a newer release exists it also brings up the footer update button.
- `about-copy-diagnostics` copies the redacted report (`Talyx <version>`, `Engine <label>`, `OS ...`, then `Last log lines:`) to the clipboard and shows "Copied." for 1.5 s.

## How to get to it (user POV)

- Choose the `Settings` button in the sidebar footer, then `About` in the Settings pages.
- Press `Meta+Comma`, then choose `About`. Settings opens on the page that was open last.

## Driving it with control-talyx

Preconditions:

- Baseline launch (`--no-engine`, seed `{"setupDone": true}`). The engine gate shows and the footer is still there. The engine is not needed.
- Network access to GitHub for the update check.

- **Open Settings.** Run `control-talyx browser click --role button --name "Settings" --exact`. The Settings pages sidebar shows.
- **Open About.** Each Settings page button is named by its title plus its detail line (`About Version, updates, diagnostics`), so match the detail. Run `control-talyx browser click --role button --name "Version, updates, diagnostics"`, then `control-talyx browser wait --role heading --name "About" --exact`. The snapshot shows the sr-only h1 `Settings: About`, the text `Talyx 1.1.0` and `Engine not found`, `button "Check for updates"` and `button "Copy diagnostics"`.
- **Check for updates.** Run `control-talyx browser click --role button --name "Check for updates"`, then `control-talyx browser wait --role button --name "Check for updates" --timeout 20000`. A `status` region holds `Talyx is up to date.`, `Talyx {version} is available.` or the failure line.
- **Copy diagnostics.** The copy overwrites the user's clipboard: save it first with `pbpaste > /tmp/talyx-verify/clipboard.bak` and put it back afterwards with `pbcopy < /tmp/talyx-verify/clipboard.bak`. Run `control-talyx browser click --role button --name "Copy diagnostics"`. The button reads `Copied.` (`control-talyx browser wait --role button --name "Copied."`), then goes back to `Copy diagnostics`. Save the clipboard with `pbpaste > /tmp/talyx-verify/evidence/settings-about/diagnostics.txt`. Its first lines are `Talyx 1.1.0` and `Engine not found`, and no line contains your home path or a key.
- **Proof.** Run `control-talyx browser snapshot --path /tmp/talyx-verify/evidence/settings-about/after.aria.txt` and `control-talyx browser screenshot --path /tmp/talyx-verify/evidence/settings-about/after.png`. Nothing is written to `settings.json`, so the snapshot, the status text and the clipboard file are the proof.
- **Cleanup.** Put the clipboard back with `pbcopy < /tmp/talyx-verify/clipboard.bak`, then run `control-talyx stop`.

## Gotchas

- `--name "Settings"` without `--exact` also matches `Close Settings` once Settings is open.
- The nav row's accessible name joins the title and the detail. Match the detail, `Version, updates, diagnostics`. A bare "About" matches the heading only with `--role heading`.
- Name not from i18n: the page's h1 is built as `Settings: About` in SettingsPage.tsx and is not one i18n value. Check it in the snapshot, not with a name flag.
- The update check uses the network: it reads the latest `latest-mac.yml` and calls the GitHub API only when that release is newer. The result depends on what has been released. Offline it shows the failure line. Accept any of the three lines unless the change is about which one shows.
- When a newer release exists, the check also opens the footer update button. Never click Download or Restart to update in a run.
- The two `status` regions have no names (one is the sr-only "Copied." announcement). Read them from the snapshot text rather than waiting on a name.
- The copy uses `navigator.clipboard.write`, so the window must be focused. If it is not, the copy fails with the "Talyx could not copy the diagnostics." toast. Bring the dev window to the front and retry before calling it a bug. The copy overwrites the real macOS clipboard.
- "Copied." lasts only 1.5 s. Wait for it right after the click.
- Right after `launch` the version line can be empty for a moment, until `app:version` answers. Wait for the heading first.
- Proven 2026-11-18 with `--no-engine`: the version lines, `Check for updates` (status `Talyx is up to date.`), `Copy diagnostics` (`Copied.`, then a report starting `Talyx 1.1.0`, `Engine not found`, `OS darwin ...` with no home path).
