# Talyx

Talyx is a desktop app to tally your AI agents: a roster of bots on the left, one chat on the right, and a manager bot that hands work to the other bots and briefs you. The bots run on an agent engine that Talyx's first-run setup installs for you; Talyx is the window onto them. It runs on macOS and Linux.

## Status

Talyx 1.0 is the first build meant for daily use. It runs on macOS and Linux and attaches to the engine on the same computer, which its first-run setup installs. You get a roster of bots with pins, folders and unread marks; a chat with each bot, with approval and question cards, images and dictation; bot details with routines and a look of its own; group rooms the engine hosts; and Settings for model providers, the engine, launch at login and the theme. Not in 1.0: Windows, remote engines, the model's reasoning in the transcript, voice mode and other languages. The [release notes](docs/release-notes/1.0.0.md) have the details.

## Before the pivot

Until version 0.11.0 Talyx was a file organizer and a hotkey assistant for macOS. That app is kept, unchanged, on the branch [`legacy/file-organizer`](https://github.com/PetarStoev02/talyx-app/tree/legacy/file-organizer) and the tag [`v0.11.0-legacy`](https://github.com/PetarStoev02/talyx-app/tree/v0.11.0-legacy). Build it from there if you want it; it gets no further changes.

## Install

Builds come from the [GitHub releases](https://github.com/PetarStoev02/talyx-app/releases).

- **macOS 13 or newer.** Open the DMG and drag Talyx to Applications, then open it. The Mac builds are signed with Developer ID, run with the hardened runtime and are notarized by Apple, so macOS opens them without a warning.
- **Linux (x64).** Download `Talyx-x86_64.AppImage`, make it executable (`chmod +x`) and run it, or install `Talyx-amd64.deb` with `sudo apt install ./Talyx-amd64.deb`. There is no Windows build yet: it comes once the engine runs there.

Talyx checks GitHub for a newer release shortly after it starts, every hour, when the computer wakes and when you come back to its window; Settings → About has **Check for updates**. Each check reads the version from the release's update feed and asks the GitHub API for the notes only when a newer release exists. A new release shows in the footer update button with its highlights, **Download** and **Later**: nothing downloads until you click. On macOS and in the AppImage it updates itself: it downloads the update, checks it against the sha512 in the release's `latest-mac.yml` or `latest-linux.yml`, and the footer update button then offers **Restart to update**. Talyx never restarts by itself; if you do not click, the update installs when you quit. On macOS the update installs only when the new app carries the same Developer ID signature as the one running. The deb cannot update itself: the update button opens the release page, and you install the new deb the same way as the first.

## Engine

Talyx runs its bots on the engine, a separate agent backend that Talyx's setup screen installs for you. Talyx needs **engine 0.22.7**.

- The engine's command must be reachable as `talyx-engine`: on your `PATH`, in `~/.local/bin/talyx-engine`, or picked with **Choose file** on the first-run screen. The setup screen installs the engine and links it as `talyx-engine`.
- Talyx attaches to the engine's gateway on this machine with `talyx-engine gateway ensure --json`. The gateway runs on its own and outlives Talyx: quitting Talyx never stops it, and the next launch attaches to the same process.
- Talyx reads every path and port from the engine's own output; it never assumes where the engine keeps its data.
- Windows cannot attach yet: minting a gateway ticket there goes through the engine's own runtime, so a Windows build comes once the engine runs there.

### Re-syncing the vendored client

Two things change when the engine moves on, and only one of them is updated from the app. The engine itself is: each Talyx release pins one engine version (`EXPECTED_ENGINE_VERSION` in `src/shared/engine.ts`, and `engine-install.json` on the release), and when the attached engine is older, the footer update button offers that version and installs it when you click **Install the engine**. The vendored client is not: when the engine's protocol changes, a developer redoes the steps below by hand and ships a new Talyx release.

`src/renderer/src/shared/engine/` is the engine desktop app's protocol client and API wrappers, cut from tag `v0.22.7` (its MIT licence is in that folder). `src/main/infrastructure/engine/gateway.ts` is its gateway attach and ticket code. When the engine moves to a new version:

1. Take the same files from the engine desktop app at the new tag: `src/api/{canonical-protocol,client,profiles,sessions,cron,models,config}.ts`, `src/types/` (the engine types file, as `types.ts`), `src/lib/{gateway-rpc,session-owner-stamp}.ts`, `src/store/transcript-tail.ts`, the shared package's `{json-rpc-gateway,json-rpc-channel,gateway-events,gateway-contract.generated,reconnect-backoff,session-http-mutations}.ts`, and `electron/local-gateway.ts` for `gateway.ts`. Take the protocol tests the same way into `tests/unit/engine/`.
2. Rename every word that carries the engine's name to `engine` (types, functions, comments, messages), point imports at the local files, and run `npx prettier --write` on them.
3. Diff against this folder and keep Talyx's changes, each marked `Talyx:` in a comment: main opens the gateway socket (`socket.ts`, `socketFactory`); REST goes through `http.ts`; wire strings and metadata keys come from `engineWire()` in `src/shared/engine.ts` at runtime; the remote-registry code paths are cut.
4. Run `npm run typecheck`, `npm run lint` and `npm test`, then send "ping" from Settings → Engine → Debug console.

Before merging an engine bump, run `TALYX_SMOKE_INSTALL_FILE=engine-install.json npm run test:smoke` and paste its summary in the PR.

## Build from source

Node 22.12 or newer (Node 24 matches the Electron runtime).

```bash
npm ci
npm run dev          # Electron + Vite with hot reload
npm test             # unit tests
npm run build:mac    # DMGs in dist/; unsigned unless a Developer ID is set up
npm run build:linux  # AppImage and deb in dist/ (x64)
```

`npm run dev` downloads Electron the first time it runs.

## Release

Releases are built by the **Release** workflow on GitHub Actions: Actions → Release → Run workflow. It builds the macOS DMGs and the Linux AppImage and deb, runs the real-engine smoke test on Linux, and creates a **draft** release `v<version>` with the installers, the update feed (`latest-mac.yml`, `latest-linux.yml`, their signatures, the macOS zips and their blockmaps), `engine-install.json` and `SHA256SUMS`. Sign its update feeds on your own machine with `npm run sign-release` (the key is never on GitHub), review the draft, then publish it. Installed copies see a release only once it is published: GitHub does not show drafts to them.

- The release body is the optional **highlights** input (lines like `- **Lead.** Text.`, shown by the update button) above `docs/release-notes/<version>.md` and GitHub's generated notes. The form takes one line; for several, run `gh workflow run release.yml -f highlights="$(cat release-highlights.md)"`.
- The workflow needs the secret `ENGINE_INSTALL_JSON`, the base64 of `engine-install.json`. Add it once, and again whenever the file changes: `gh secret set ENGINE_INSTALL_JSON < <(base64 -i engine-install.json)`. Each job checks it against `ENGINE_INSTALL_SHA256` and fails when it is missing or does not match.

`npm run release` (`scripts/release.sh`) is the local path: macOS DMGs only, from your own machine, with the same install-file check.

## Privacy

Talyx has no server, no account and no telemetry. The only network calls Talyx makes itself are three to GitHub: the update check; the update itself from the release when you click Download (through the signed update feed, on macOS and in the AppImage); and, at first-run setup, the release's `engine-install.json`, the steps that install the engine. What your bots send to their model providers is between the engine and those providers; Talyx itself sends nothing anywhere else. Third-party components are listed in [CREDITS.md](CREDITS.md).

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, checks and conventions, and [SECURITY.md](SECURITY.md) to report a security issue privately.

## Website

`website/` is [talyx.app](https://talyx.app) (Vite + React):

```bash
cd website && npm ci && npm run build
```

## License

MIT, see [LICENSE](LICENSE). Third-party credits are in [CREDITS.md](CREDITS.md).

<sub>The engine is [Hermes Agent](https://github.com/NousResearch/hermes-agent) by Nous Research (MIT), used as it ships.</sub>
