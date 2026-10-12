# Security

Talyx lets an AI operate your Mac, so security reports matter. Thank you for taking the time.

## Reporting a vulnerability

Report it privately at <https://github.com/PetarStoev02/talyx-app/security/advisories/new>. Do not open a public issue.

Include what you found, the steps to reproduce it, the Talyx and macOS versions, and what an attacker could do with it. You will get an answer within a week. Once a fix is released, the advisory is published with credit to you unless you ask otherwise.

## Supported versions

Only the latest release gets security fixes. Talyx checks GitHub for new releases on launch.

## In scope

- An action that changes something on the Mac without an approval card (beyond watch folders and scheduled sorts the user set up).
- A way for a web page, a file being sorted, or a model reply to run code or reach abilities it should not.
- Files or data leaving the Mac in a way the app or the README does not describe.
- Bypassing the Electron security settings (sandbox, context isolation, fuses).

## Known limits

These are documented and not vulnerabilities on their own:

- Releases are ad-hoc signed and not notarized or hardened, so software already running as your user could inject code into Talyx.
- With Your Claude sorting or the assistant, what you send goes to Anthropic through your own account, as the README describes.
