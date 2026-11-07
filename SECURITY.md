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
- In-app updates trust the GitHub release they come from. On macOS and in the AppImage, Talyx updates itself: it checks the downloaded zip or AppImage against the sha512 listed in the release's `latest-mac.yml` or `latest-linux.yml`. On macOS, Squirrel.Mac then installs the update only if the new app's code signature satisfies the running app's designated requirement, so it must be signed with the same Developer ID; the AppImage has no signature to check. Where Talyx falls back to the installer download (a release without the update feed), it checks the installer against `SHA256SUMS` from the same release. Each check catches a broken or tampered download, but not a compromised GitHub account or repository, which could replace the files and the `.yml` or `SHA256SUMS` together. On macOS the signature check still holds in that case unless the Developer ID itself is compromised; on Linux nothing does. The engine install file has a second check that does not depend on the release: its SHA-256 is pinned inside the app (`src/main/infrastructure/setup/installPin.ts`), so Talyx refuses a replaced `engine-install.json`. That pin ships in the app itself, so a compromised release that also replaces the app gets past it. An installer Talyx downloads has no quarantine attribute, so macOS does not check its signature when it is opened; on that fallback path the SHA-256 check is the integrity guarantee.
