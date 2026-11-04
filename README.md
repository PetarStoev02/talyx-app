# Talyx

Talyx is a desktop app to tally your AI agents: a roster of bots on the left, one chat on the right, and a manager bot that hands work to the other bots and briefs you. The bots run on an agent engine you install yourself; Talyx is the window onto them. It runs on macOS, Windows and Linux.

## Status

Talyx is being rebuilt. Version 1.0.0-alpha.1 is an empty shell: the sidebar, an Agents page with nothing on it yet, and Settings with the theme. The roster, chat, bot details, group rooms and providers arrive in the next releases, one at a time. 1.0 is the first build meant for daily use.

## Before the pivot

Until version 0.11.0 Talyx was a file organizer and a hotkey assistant for macOS. That app is kept, unchanged, on the branch [`legacy/file-organizer`](https://github.com/PetarStoev02/talyx-app/tree/legacy/file-organizer) and the tag [`v0.11.0-legacy`](https://github.com/PetarStoev02/talyx-app/tree/v0.11.0-legacy). Build it from there if you want it; it gets no further changes.

## Install

Builds come from the [GitHub releases](https://github.com/PetarStoev02/talyx-app/releases). None of them is signed or notarized: there is no Apple developer account and no Windows certificate. Your system warns you the first time you open each new version.

- **macOS 13 or newer.** Open the DMG and drag Talyx to Applications. Open Talyx and dismiss the warning. Then go to System Settings → Privacy & Security, scroll down and click **Open Anyway**; macOS asks for your password. Or run once in Terminal: `xattr -dr com.apple.quarantine /Applications/Talyx.app`
- **Windows and Linux.** Installers come with 1.0. Until then, build from source.

Talyx checks GitHub for a newer release and opens the release page. It installs nothing itself.

The engine install step comes with the release that connects Talyx to it.

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
