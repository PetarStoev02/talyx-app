# Providers

Settings, Providers is where a user tells Talyx where its bots get their models. The page lists every saved provider as one row: custom endpoints (with an `Active` badge, a `Models:` list, and `Test chat`, `Edit`, `Remove`), API keys (`API key ••••`, `Reveal` or `Hide`, `Remove`), and signed-in accounts (`Signed in`, `Sign out`). `Add provider` opens a dialog with three kinds (`API key`, `Account`, `Custom endpoint`). Each kind has its own form with `Save` and `Check`, and an account can be signed in from there. Under the list, `Talyx’s model` picks the model Talyx answers on, which new bots copy. Every change applies at once and goes to every bot; there is no Save for the page.

## Sub-features

- `providers-open` reaches the Providers page from the Settings pages sidebar.
- `providers-list` shows endpoints, keys and accounts, or "No provider yet." with its own `Add provider`.
- `providers-add-key` adds an API key: a `Provider` select, an `API key` field, `Check`, `Save`.
- `providers-sign-in` lists the accounts that are signed out, each with `Sign in`. A sign-in uses a browser code, a pasted code, or a terminal command with `Check again` and `Copy`.
- `providers-endpoint` adds or edits an endpoint: `Name`, `Base URL`, `API key`, `Models`.
- `providers-remove` asks before it removes a key, endpoint or model, or signs out an account (`Remove key`, `Remove endpoint`, `Remove model`, `Sign out`, `Cancel`).
- `providers-test-chat` sends one test message to an endpoint (`Send test message`).
- `providers-default-model` is the `Talyx’s model` menu. A costly model asks `Use this model?` first.

## How to get to it (user POV)

- Choose `Settings` in the sidebar footer, then `Providers` in the Settings pages.
- Press `Meta+Comma`. Settings opens on the last page it showed.
- First-run setup's Provider step shows the same section.

## Driving it with control-talyx

Preconditions:

- Engine-backed. Launch with `--real-engine` (seed `{"setupDone": true}`). The list then shows the user's real providers. This recipe only reads: it creates nothing and needs no `Verify scratch` bot.
- `control-talyx doctor` reports `ok`.

- **Open Settings.** Run `control-talyx browser click --role button --name "Settings" --exact`. The Settings pages show.
- **Open Providers.** Run `control-talyx browser click --role button --name "Providers"`, then `control-talyx browser wait --role heading --name "Providers" --exact`. The page shows the hint "Where your bots get their models.", either the rows or "No provider yet.", and the heading `Talyx’s model`.
- **Before.** Run `control-talyx browser screenshot --path /tmp/talyx-verify/evidence/settings-providers/before.png`.
- **Open the dialog.** Run `control-talyx browser click --role button --name "Add provider" --exact`, then `control-talyx browser wait --role dialog --name "Add provider"`. The group `Provider kind` shows `API key` (pressed), `Account` and `Custom endpoint`, plus a combobox `Provider` and a textbox `API key`.
- **Endpoint form.** Run `control-talyx browser click --role button --name "Custom endpoint"`. Textboxes `Name`, `Base URL`, `API key` and `Models` appear, with buttons `Save` and `Check`. Fill nothing.
- **Account list.** Run `control-talyx browser click --role button --name "Account" --exact`. Either one button per signed-out account (its name, then `Sign in`) or "Every account is signed in." shows. Do not click a sign-in.
- **Proof.** Run `control-talyx browser snapshot --path /tmp/talyx-verify/evidence/settings-providers/after.aria.txt` and `control-talyx browser screenshot --path /tmp/talyx-verify/evidence/settings-providers/after.png`.
- **Cleanup.** Run `control-talyx browser press --key Escape`. The dialog closes and the provider list is unchanged. A second Escape leaves Settings. Then run `control-talyx stop`.

## Gotchas

- In an isolated run the Providers page shows the engine gate (`Talyx needs its engine.`, `Install the engine`, `Try again`, `Choose file`), not the list. Only the gate can be proven there.
- Real engine: the providers belong to the user, and every write reaches every bot. Never press `Save`, `Remove`, `Sign out`, `Send test message` or `Reveal`, and never pick from the `Talyx’s model` menu without the user's approval.
- `Check` and `Test chat` call the provider over the network. `Sign in` opens the system browser (`window.open`), which CDP cannot see. `Copy` writes to the clipboard.
- The Settings pages rows are named title plus detail ("Providers" then "Keys, sign-ins and Talyx’s model"), so match `Providers` without `--exact`.
- The textbox names include the hint text inside their label (for example the link "Where to get a key"), so never use `--exact` on them. `Check` needs `--exact` because `Check again` exists.
- Name not from i18n: the model menu trigger's aria-label is the template `Talyx’s model: <model>` in ModelPicker.tsx. Match it as a button by substring `Talyx’s model` (curly apostrophe U+2019).
- Name not from i18n: provider, endpoint, account and model names come from the engine. The removal dialog titles ("Remove the {name} key?") contain those names, so describe those dialogs in prose and never pass them as a quoted name flag.
- Name not from i18n: the dialog's X button is a hard-coded sr-only `Close` in dialog.tsx. Use Escape instead.
- With no providers there are two `Add provider` buttons (the header and the empty state). The driver clicks the first.
- The list reloads whenever the window gets focus. Snapshot again before you assert on rows.
- Written from the code (2026-11-18); confirm roles from a snapshot.
