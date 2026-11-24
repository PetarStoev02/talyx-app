# Usage

The chart button in the sidebar footer (named `Usage`) opens the Usage page. It shows how many tokens and requests every bot used over a recent period. The page's sidebar replaces the roster with `Back`, `All providers` and one row for each provider. The header has a `Period` group with `7 days`, `30 days` (the default) and `90 days`, plus a `Refresh usage` button. With All providers picked, the page shows the total ("tokens, all bots" and the request count), `Tokens per day` (a chart, then "Show the days as a table"), `Providers` (one row per provider, each opening that provider) and `By model` (a table with Model, Requests, Tokens). Picking a provider shows its name, its total, "% of all tokens", its days and its models. While the footer button is open it reads `Close Usage`. That button, `Back` or Escape returns to the page Usage was opened from. Without the engine there is no Usage button: the engine gate fills the window.

## Sub-features

- `usage-open` opens the page from the footer `Usage` button. The button becomes `Close Usage` and is marked current.
- `usage-close` leaves through `Close Usage`, the sidebar `Back` or Escape, back to the page it was opened from.
- `usage-period` picks 7, 30 or 90 days. The picked one is pressed and the report reloads. The pick is not saved to settings.
- `usage-refresh` loads the report again. The icon spins while it loads.
- `usage-all` shows the total, Tokens per day, Providers and By model for every provider together.
- `usage-provider` picks one provider in the sidebar or the Providers list: its total, share, days and models.
- `usage-days-table` is the "Show the days as a table" disclosure under the daily chart.
- `usage-gated` shows "Talyx needs its engine." inside the page when the engine is missing.

## How to get to it (user POV)

- Choose the `Usage` button (chart icon) in the sidebar footer, to the right of `Settings`. There is no keyboard shortcut.
- To leave, choose `Close Usage` in the same place, `Back` at the top of the sidebar, or press Escape.

## Driving it with control-talyx

Preconditions:

- Baseline launch (isolated, seed `{"setupDone": true}`). This covers open, close, period and the gate. The report itself (totals, providers, models) needs the real engine (`launch --real-engine`). It is read-only: drive no bot and create nothing.

- **Open Usage.** Run `control-talyx browser click --role button --name "Usage" --exact`. The snapshot has the heading `Usage`, the sidebar `Back` above the navigation `Usage by provider` (with `All providers`), the group `Period` with `30 days` pressed, `button "Refresh usage"`, and in the footer `button "Close Usage"`. Without the engine the body has the heading `Talyx needs its engine.`.
- **Pick a period.** Run `control-talyx browser click --role button --name "7 days" --exact`. The `7 days` button is pressed and `30 days` is not.
- **Refresh.** Run `control-talyx browser click --role button --name "Refresh usage"`. Without the engine nothing changes. With the engine, the report reloads.
- **Report (engine only).** Run `control-talyx browser wait --role heading --name "Tokens per day"`. The headings `Providers` and `By model` show. Choose a provider row under `Usage by provider`. The provider's name heading and its `By model` list show. Then run `control-talyx browser click --role button --name "All providers"`.
- **Proof.** Run `control-talyx browser snapshot --path /tmp/talyx-verify/evidence/usage-page/after.aria.txt` and `control-talyx browser screenshot --path /tmp/talyx-verify/evidence/usage-page/after.png`.
- **Close.** Run `control-talyx browser click --role button --name "Close Usage"`. The Agents page (or the engine gate) is back and the footer button reads `Usage`. Then open Usage again and run `control-talyx browser click --role button --name "Back" --exact`, and once more with `control-talyx browser press --key Escape`. Both return to the same page.
- **Restore.** The period lives only in memory: it holds while the app runs (closing and reopening Usage keeps `7 days`) and resets to 30 days on the next launch. Optionally run `control-talyx browser click --role button --name "30 days" --exact` while the page is open.

## Gotchas

- `--name "Usage"` needs `--exact`. Otherwise it also matches `Close Usage`, `Usage by provider` and `Refresh usage`.
- `--name "Back"` needs `--exact`. Other pages may have their own back controls.
- Without the engine, `Refresh usage` does nothing, the sidebar lists only `All providers`, and the gate's `Choose file` opens a native panel that CDP cannot drive.
- The report's numbers come from the real engine and the user's real usage. Assert only the structure (headings, pressed period), never figures. Provider and model names come from the engine, not from i18n, so the map names them in prose, never as a quoted control name.
- The period buttons are toggle buttons (`aria-pressed`), not tabs. The provider rows are buttons, and the open one has `aria-current="page"`.
- Escape does not leave the page while a dialog or menu holds it.
- "Show the days as a table" is a `details` summary, which the snapshot may show as a disclosure triangle rather than a button.
- No-engine steps proven 2026-11-18 (open, 7 days, Refresh usage, Close Usage, Back, Escape). The report with the engine is written from the code; confirm roles from a snapshot.
