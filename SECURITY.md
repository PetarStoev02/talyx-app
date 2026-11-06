# Security

Talyx is the window onto AI agents that act on your behalf, so security reports matter. Thank you for taking the time.

## Reporting a vulnerability

Report it privately at <https://github.com/PetarStoev02/talyx-app/security/advisories/new>. Do not open a public issue.

Include what you found, the steps to reproduce it, the Talyx version and your operating system, and what an attacker could do with it. You will get an answer within a week. Once a fix is released, the advisory is published with credit to you unless you ask otherwise.

## Supported versions

Only the latest release gets security fixes. Talyx checks GitHub for new releases on launch.

## In scope

- A way for a web page, a link or text shown in the app to run code or reach the app's internals.
- Data leaving the machine in a way the app or the README does not describe.
- Bypassing the Electron security settings (sandbox, context isolation, fuses).

## Known limits

These are documented and not vulnerabilities on their own:

- Releases are not signed, notarized or hardened, so software already running as your user could inject code into Talyx.
- In-app updates trust the GitHub release they come from. Talyx checks the downloaded installer against `SHA256SUMS` from the same release, so the check catches a broken or tampered download but not a compromised GitHub account or repository, which could replace the installer and `SHA256SUMS` together. The engine install file does not share this limit: its SHA-256 is pinned inside the app (`src/main/infrastructure/setup/installPin.ts`), so Talyx refuses any other file. A Developer ID signature check on the downloaded app is planned with [#27](https://github.com/PetarStoev02/talyx-app/issues/27).
