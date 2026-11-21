# Module activation

Modules stay hidden until a license is active. With no key, nothing in Talyx mentions modules: Settings lists only General, Providers, Engine and About. The way in is "Enter License Key…" in the app menu (Cmd+Shift+L, or Ctrl+Shift+L on Linux) or a talyx://activate link. Either one opens the "Enter license key" dialog ("Paste the key from your purchase email."), which has a "License key" field, Activate and Cancel. A link only fills in the key: the user still has to press Activate. A bad key shows an error under the field. A good key shows "Activated for {name}. Install the modules it unlocks:" with a row per module (Install or Update) and Done. After that, Settings has a Modules page ("License and installed modules"). It shows "Licensed to {name}", "Valid until {date}" or "No expiry date", Remove license, and the module rows with Uninstall. Uninstall asks first in an "Uninstall {name}?" dialog.

## Sub-features

- `modules-hidden` means no Modules row in Settings pages and no module UI anywhere without a license.
- `activation-open` opens the dialog from the menu item, its shortcut, or a talyx://activate link (the link fills in the key).
- `activation-invalid` shows the error from main (for example "This key is not valid.") as an alert and stores nothing.
- `activation-success` switches the dialog to "Activated for {name}…" with the module list and Done, and stores `licenseKey` in `settings.json`.
- `activation-replaces` shows a note when a license is already active: the new key replaces it.
- `modules-settings` is the Settings Modules page: licensee, expiry, Remove license, and the installed modules list with Install, Update and Uninstall.
- `modules-uninstall` opens the "Uninstall {name}?" confirmation with Uninstall and Cancel.

## How to get to it (user POV)

- On macOS: Talyx menu, then "Enter License Key…", or press Cmd+Shift+L. On Linux: File menu or Ctrl+Shift+L.
- Click a talyx://activate?key=... link from the purchase email. This works only in the installed app, because a dev run does not register the scheme.
- Once a key is active: Settings in the sidebar footer, then Modules in Settings pages.

## Driving it with control-talyx

Preconditions:

- Baseline launch (`--no-engine`, seed `{"setupDone": true}`). The engine gate fills the window, with no sidebar; the dialog opens from the app menu all the same. The Settings steps below need the engine (see [First-run setup](./first-run-setup.md)).
- `control-talyx settings` has `"licenseKey": null` or no `licenseKey` key.

- **Hidden without a key.** Run `control-talyx browser click --role button --name "Settings" --exact`. The navigation `Settings pages` lists General, Providers, Engine and About, with no Modules row. Run `control-talyx browser snapshot --path /tmp/talyx-verify/evidence/module-activation/before.aria.txt` and check that it does not contain `License and installed modules`.
- **Open the dialog.** Run `control-talyx browser press --key Meta+Shift+L`, then `control-talyx browser wait --role dialog --name "Enter license key" --timeout 5000`. If the wait times out, the shortcut did not reach the native menu (see Gotchas). Report `activation-open` as not drivable and go to Proof.
- **Invalid key.** Run `control-talyx browser fill --role textbox --name "License key" --value "TALYX-not-a-real-key"`, then `control-talyx browser click --role button --name "Activate" --exact`. An alert with the error from main shows under the field, and the dialog stays on the key form.
- **Nothing stored.** Run `control-talyx settings > /tmp/talyx-verify/evidence/module-activation/settings.json`. `licenseKey` is still null.
- **Proof.** Run `control-talyx browser snapshot --path /tmp/talyx-verify/evidence/module-activation/after.aria.txt` and `control-talyx browser screenshot --path /tmp/talyx-verify/evidence/module-activation/after.png`.
- **Cleanup.** Run `control-talyx browser click --role button --name "Cancel" --exact`. The dialog closes. Then run `control-talyx stop`.

## Gotchas

- The only ways in are the native app menu and its accelerator. `press` sends CDP key events to the page, not to the native menu, so Cmd+Shift+L will probably not open the dialog in a run. CDP cannot click the menu either.
- A dev run does not call `setAsDefaultProtocolClient`. On macOS, opening a talyx://activate link reaches the installed Talyx, not the run. Never open one during verification.
- `activation-success`, `modules-settings` and `modules-uninstall` need a real Ed25519-signed key from the owner. A made-up key is always refused. Do not use a real key without the owner's approval. The module list also reads the catalog over the network, so offline it shows "Talyx could not check for modules. Check your connection and reopen this."
- Name not from i18n: the error text comes from main (`src/main/infrastructure/modules/signing.ts`, "This key is not valid.", "This key has expired.").
- Name not from i18n: the menu label "Enter License Key…" (`src/main/lib/appMenu.ts`).
- Name not from i18n: the dialog's "Close" button (`src/renderer/src/shared/ui/dialog.tsx`, sr-only text). Use Cancel instead.
- Name not from i18n: the field's placeholder is "TALYX-…". Its accessible name comes from the "License key" label.
- Each Settings pages button's accessible name is its title plus its detail ("Modules License and installed modules"), so substring matching is needed.
- Remove license clears the license but keeps installed files. Restoring a key afterwards needs the key again.
- Run 2026-11-18 with `--no-engine`: `modules-hidden` proven (no Modules row). `press --key Meta+Shift+L` did not open the dialog (the accelerator belongs to the native menu), so `activation-open` and everything after it is not drivable with control-talyx; the dialog steps are written from the code.
