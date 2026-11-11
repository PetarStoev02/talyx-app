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
- In-app updates need more than the GitHub release they come from. On macOS and in the AppImage, Talyx updates itself, and only through the release's update feed (`latest-mac.yml` or `latest-linux.yml`): the feed must carry an Ed25519 signature made with a key that is kept off GitHub (its public half ships in the app), it must list each file to download by name, sha512 and size, and each download must match that sha512. On macOS, Squirrel.Mac then installs the update only if the new app's code signature satisfies the running app's designated requirement, so it must be signed with the same Developer ID; the AppImage has no signature of its own to check. A release without a signed feed is offered as a link to its page and nothing is downloaded. So someone who compromises the GitHub account or repository can publish a release, but cannot make an installed Talyx download it; they would also need the update signing key, or to get their code merged into `main` and signed by the owner. Versions 1.0.5 and older do not check the feed's signature. What a user downloads by hand from a release page has only that release's own `SHA256SUMS` behind it (and, on macOS, Gatekeeper). The engine install file has a second check that does not depend on the release: its SHA-256 is pinned inside the app (`src/main/infrastructure/setup/installPin.ts`), so Talyx refuses a replaced `engine-install.json`. That pin ships in the app itself, so a compromised release that also replaces the app gets past it.
