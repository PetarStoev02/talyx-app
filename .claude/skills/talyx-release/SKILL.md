---
name: talyx-release
description: Release a new Talyx version through the Release workflow, sign its update feeds on the owner's machine and publish the draft. Use for "release", "ship 1.x.y", "cut a release", "publish the draft" or "sign the release".
---

# Release Talyx

The reference is `docs/releasing.md`; read it when a step fails. Every release reaches every
installed Talyx, so the owner runs the signing and publishing steps. Do not run them unasked.

## Before

1. `main` has the release commit: `package.json` `version` bumped, CI green.
2. Write `docs/release-notes/<version>.md` and merge it. No engine name.
3. Check the signing certificate and the Apple membership have not expired.
4. If `engine-install.json` changed: its SHA-256 equals `ENGINE_INSTALL_SHA256` in
   `src/main/infrastructure/setup/installPin.ts` (pin updated in the same commit as the
   commands), its `engineVersion` equals `EXPECTED_ENGINE_VERSION` in `src/shared/engine.ts`, and
   `gh secret set ENGINE_INSTALL_JSON < <(base64 -i engine-install.json)` ran.

## Build the draft

5. Actions → Release → Run workflow on `main`, with the optional `highlights` input
   (1-3 lines, `- **Lead.** Text.`).
6. Wait for every job: macOS DMGs, Linux AppImage + deb, the real-engine smoke test, the draft
   release `v<version>`. A job that fails before the build names the missing secret.

## Sign and publish (owner's machine)

7. On an up-to-date `main` checkout (it reads the version from `package.json`),
   `npm run sign-release`. It checks the draft's feeds against the workflow run's own `feeds`
   artifact, lists the commits since the last release and asks before it signs. Read that list.
8. Read the draft on GitHub, then publish:
   `gh release edit v<version> --repo PetarStoev02/talyx-app --draft=false`.

## After

9. Download the run's `aur` artifact and push it to the AUR by hand (`packaging/aur/README.md`).
10. Check an installed Talyx: Settings → About → Check for updates offers the release with
    Download.

The local path (`npm run release`, macOS DMGs only) is in `docs/releasing.md` → The local release
path.
