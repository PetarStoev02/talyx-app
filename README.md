# Talyx

Talyx is a desktop app to tally your AI agents: a roster of bots on the left, one chat on the right, and a manager bot that hands work to the other bots and briefs you. The bots run on an agent engine you install yourself; Talyx is the window onto them. It runs on macOS, Windows and Linux.

## Status

Talyx is being rebuilt. Version 1.0.0-alpha.1 is an empty shell: the sidebar, an Agents page with nothing on it yet, Settings with the theme, and an Engine (debug) page that proves Talyx can talk to the engine. The roster, chat, bot details, group rooms and providers arrive in the next releases, one at a time. 1.0 is the first build meant for daily use.

## Before the pivot

Until version 0.11.0 Talyx was a file organizer and a hotkey assistant for macOS. That app is kept, unchanged, on the branch [`legacy/file-organizer`](https://github.com/PetarStoev02/talyx-app/tree/legacy/file-organizer) and the tag [`v0.11.0-legacy`](https://github.com/PetarStoev02/talyx-app/tree/v0.11.0-legacy). Build it from there if you want it; it gets no further changes.

## Install

Builds come from the [GitHub releases](https://github.com/PetarStoev02/talyx-app/releases). None of them is signed or notarized: there is no Apple developer account and no Windows certificate. Your system warns you the first time you open each new version.

- **macOS 13 or newer.** Open the DMG and drag Talyx to Applications. Open Talyx and dismiss the warning. Then go to System Settings → Privacy & Security, scroll down and click **Open Anyway**; macOS asks for your password. Or run once in Terminal: `xattr -dr com.apple.quarantine /Applications/Talyx.app`
- **Windows and Linux.** Installers come with 1.0. Until then, build from source.

Talyx checks GitHub for a newer release and opens the release page. It installs nothing itself.

## Engine

Talyx runs its bots on the engine, a separate agent backend you install yourself. Talyx needs **engine 0.22.5**.

- The engine's command must be reachable as `talyx-engine`: on your `PATH`, in `~/.local/bin/talyx-engine` (on Windows, `%USERPROFILE%\.local\bin\talyx-engine.exe`), or picked with **Choose file** on the first-run screen. The engine's installer gives its command another name, so make a link once, for example `ln -s <the engine's command> ~/.local/bin/talyx-engine`.
- Talyx attaches to the engine's gateway on this machine with `talyx-engine gateway ensure --json`. The gateway runs on its own and outlives Talyx: quitting Talyx never stops it, and the next launch attaches to the same process.
- Talyx reads every path and port from the engine's own output; it never assumes where the engine keeps its data.
- Windows cannot attach yet: minting a gateway ticket there goes through the engine's own runtime, which comes with the 1.0 release work.

### Re-syncing the vendored client

`src/renderer/src/shared/engine/` is the engine desktop app's protocol client and API wrappers, cut from tag `v0.22.7` (its MIT licence is in that folder). `src/main/infrastructure/engine/gateway.ts` is its gateway attach and ticket code. When the engine moves to a new version:

1. Take the same files from the engine desktop app at the new tag: `src/api/{canonical-protocol,client,profiles,sessions,cron,models,config}.ts`, `src/types/` (the engine types file, as `types.ts`), `src/lib/{gateway-rpc,session-owner-stamp}.ts`, `src/store/transcript-tail.ts`, the shared package's `{json-rpc-gateway,json-rpc-channel,gateway-events,gateway-contract.generated,reconnect-backoff,session-http-mutations}.ts`, and `electron/local-gateway.ts` for `gateway.ts`. Take the protocol tests the same way into `tests/unit/engine/`.
2. Rename every word that carries the engine's name to `engine` (types, functions, comments, messages), point imports at the local files, and run `npx prettier --write` on them.
3. Diff against this folder and keep Talyx's changes, each marked `Talyx:` in a comment: main opens the gateway socket (`socket.ts`, `socketFactory`); REST goes through `http.ts`; wire strings and metadata keys come from `engineWire()` in `src/shared/engine.ts` at runtime; the remote-registry code paths are cut.
4. Run `npm run typecheck`, `npm run lint` and `npm test`, then send "ping" from the Engine (debug) page.

Before merging an engine bump, run `npm run test:smoke` and paste its summary in the PR.

## Build from source

Node 22.12 or newer (Node 24 matches the Electron runtime).

```bash
npm ci
npm run dev          # Electron + Vite with hot reload
npm test             # unit tests
npm run build:mac    # ad-hoc signed DMGs in dist/, no Apple account needed
```

`npm run dev` downloads Electron the first time it runs.

## Privacy

Talyx has no server, no account and no telemetry. Today the only network call is the update check against GitHub. Once Talyx talks to the engine, what your bots send to their model providers is between the engine and those providers; Talyx itself sends nothing anywhere else. Third-party components are listed in [CREDITS.md](CREDITS.md).

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
