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

- The Linux builds are not signed. The macOS builds are signed with Developer ID, notarized and run with the hardened runtime.
- In-app updates trust the GitHub release they come from. Talyx checks the downloaded installer against `SHA256SUMS` from the same release, so the check catches a broken or tampered download but not a compromised GitHub account or repository, which could replace the installer and `SHA256SUMS` together. The engine install file has a second check that does not depend on the release: its SHA-256 is pinned inside the app (`src/main/infrastructure/setup/installPin.ts`), so Talyx refuses a replaced `engine-install.json`. That pin ships in the app itself, so a compromised release that also replaces the app gets past it. An in-app download has no quarantine attribute, so macOS does not check its signature when it is opened; the SHA-256 check is the integrity guarantee. Talyx does not yet check the Developer ID signature itself.
