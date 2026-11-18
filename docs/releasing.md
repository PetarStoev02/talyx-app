# Building and releasing Talyx

The procedure as steps is the `talyx-release` skill (`.claude/skills/talyx-release/SKILL.md`).
This file is the reference behind it.

## Builds

Talyx 1.0 ships for macOS and Linux (no Windows build yet). The macOS releases are signed with
Developer ID, run with the hardened runtime (`build/entitlements.mac.plist` lists and justifies
each exception) and are notarized: the .app and the DMG are both stapled, so Gatekeeper opens them
with no warning. Linux builds are not signed.

Electron 44 needs macOS 13 or newer; every macOS version Talyx runs on requires a Developer ID
app to be notarized, so a release is never shipped signed but not notarized.

`npm run build:mac` needs no credentials: with no Developer ID available it builds unsigned DMGs
(the fuses' ad-hoc signature keeps them runnable on Apple Silicon) for local testing only. Both
release paths pass `forceCodeSigning`, notarize and staple the DMGs, and check them with
`verify_mac_release` (`codesign --verify --deep --strict`, `spctl -a -vv`, `xcrun stapler validate`).

## Updates

Talyx updates itself on macOS and in the AppImage with electron-updater (GitHub provider,
`publish` in `electron-builder.yml`). The release check runs 15 seconds after start, hourly, on
wake and on window focus (at most every 15 minutes), one at a time; Settings → About has Check for
updates. It reads the version from the latest release's `latest-mac.yml` / `latest-linux.yml`
(CDN, no API rate limit) and calls the GitHub API only for a newer release.

The update button then offers the release with Download and Later: nothing downloads until the
click, then it offers Restart to update, and quitting installs it. It never downloads or restarts
unasked.

The download is checked three ways:

- the feed must carry Talyx's Ed25519 signature (`latest-*.yml.sig`, checked against
  `UPDATE_FEED_KEY` in `updater/feedSignature.ts`) and list each offered file by name, sha512 and
  size;
- each file must match that sha512;
- and on macOS Squirrel.Mac requires the same code signature.

The signing key is never on GitHub, so a release someone else publishes on the repository cannot
update an installed Talyx. A deb, or a release without the signed feed, gets the release page and
no in-app download.

## The Release workflow

Releases come from the Release workflow (`.github/workflows/release.yml`, Actions → Release → Run
workflow): macOS DMGs, Linux AppImage + deb, the real-engine smoke test on Linux, then a draft
release `v<version>` with the update feed (`latest-*.yml`, the mac zips and their blockmaps),
`engine-install.json` and `SHA256SUMS` (for checking a download by hand). Drafts are invisible to
installed apps until published.

The run also keeps an `aur` artifact: `packaging/aur/PKGBUILD` and `.SRCINFO` bumped to the
release's deb by `packaging/aur/bump.sh`; the owner pushes it to the AUR by hand
(`packaging/aur/README.md`, which also records why there is no Flatpak).

The release's body is the optional `highlights` input under `## Highlights`, then
`docs/release-notes/<version>.md` (write it before releasing; no engine name), then GitHub's
generated notes.

The workflow needs the secret `ENGINE_INSTALL_JSON` (base64 of `engine-install.json`), set once
per file change with `gh secret set ENGINE_INSTALL_JSON < <(base64 -i engine-install.json)`; each
job checks it with `scripts/release-lib.sh`, which `release.sh` shares. The mac job also needs the
five signing secrets below and fails before the build when one is missing.

## Signing the update feeds

The workflow does not sign the update feeds. After it, run `npm run sign-release`
(`scripts/sign-release.sh`) on the owner's machine, then publish the draft.

It signs the feeds the workflow run itself kept (its `feeds` artifact, which nothing outside that
run can change), for a run of `release.yml` on `main` at the draft's commit, and only when the
draft's feeds are those same bytes and every file in the draft was uploaded by a workflow. It
lists the commits since the last release and asks before it signs: that is the one human look at
what reaches every installed Talyx. Then it adds `latest-*.yml.sig` to the draft.

A release published without it still shows in the update button, with its release page instead
of Download.

## The local release path

`npm run release` (`scripts/release.sh`) is the local path, macOS DMGs only.

Before it, write the gitignored `release-highlights.md` at the repo root: 1-3 lines
`- **Lead.** Text.`. The script puts them under `## Highlights`, then
`docs/release-notes/<version>.md`, then GitHub's generated notes, the same body as the workflow;
the update button shows the highlights. Without the file the script warns and the release has no
highlights.

`npm run release` needs `engine-install.json` (the engine install steps the app fetches from the
release) at the repo root. It is gitignored, and its SHA-256 must equal `ENGINE_INSTALL_SHA256` in
`src/main/infrastructure/setup/installPin.ts`; the script also requires the file's
`engineVersion` to equal `EXPECTED_ENGINE_VERSION` and exactly one commit hash in it, and refuses
to release otherwise. Changing the commands means updating that pin in the same commit.

It also needs the five signing variables below in the environment and the update signing key,
and refuses without them; it signs `latest-mac.yml` itself.

## Signing secrets

The account owner creates these once; never commit them or paste them anywhere else. Set each as
an Actions secret on `PetarStoev02/talyx-app`:

- `CSC_LINK`: the Developer ID Application certificate as base64 of a `.p12`. In Xcode →
  Settings → Accounts → Manage Certificates, add a Developer ID Application certificate (or create
  it at developer.apple.com → Certificates). In Keychain Access, export the certificate with its
  private key as a `.p12`. Then `gh secret set CSC_LINK < <(base64 -i DeveloperID.p12)`.
- `CSC_KEY_PASSWORD`: the password chosen for that `.p12` export. `gh secret set CSC_KEY_PASSWORD`.
- `APPLE_ID`: the Apple Account email of the developer account. `gh secret set APPLE_ID`.
- `APPLE_APP_SPECIFIC_PASSWORD`: an app-specific password for that account, from
  account.apple.com → Sign-In and Security → App-Specific Passwords (shown only once).
  `gh secret set APPLE_APP_SPECIFIC_PASSWORD`. Check it first with
  `xcrun notarytool history --apple-id <email> --team-id <team> --password <password>`.
- `APPLE_TEAM_ID`: the team ID in the Developer ID certificate's name (`3Z52YUB6CN`).
  `gh secret set APPLE_TEAM_ID`.

## The update signing key

The update signing key is not a secret on GitHub and must never become one: a key there could be
taken by whoever gets into the repository, which is the case it guards against. It is the Ed25519
private key `~/.config/talyx/keys/update.private.pem` on the owner's machine (keep a
passphrase-protected copy somewhere outside it); its public half is `UPDATE_FEED_KEY` in
`updater/feedSignature.ts`. Every installed Talyx refuses a feed signed with another key, so a lost
key means users update once by hand from the release page, to a build that ships a new public key.

## Notarizing from your own Mac

For `npm run release` on your own Mac, keep the Apple password out of the process list: store it
once with `xcrun notarytool store-credentials talyx --apple-id <email> --team-id <team>` (it asks
for the app-specific password), then set `APPLE_KEYCHAIN_PROFILE=talyx` in place of `APPLE_ID`,
`APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID`. The workflow keeps the three secrets.

## Renewal

The certificate expires after five years and the membership yearly; renew both before a release.
