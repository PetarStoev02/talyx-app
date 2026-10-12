# Talyx

Talyx is a hotkey overlay for macOS where your own Claude (an Anthropic API key, or your signed-in Claude Code) operates your Mac through typed abilities. Anything that changes something shows an approval card first; you decide. File sorting is one of the abilities: Smart Local (file extension and metadata, the default, nothing leaves your Mac) or Your Claude (the same account the assistant uses).

## Why Talyx is open source

I built Talyx on my own for almost two years. It started as a file organizer and grew into
a personal harness: your own Claude operating your Mac through typed abilities, with every
action behind an approval gate.

Big tech companies now ship assistants like this with their own models, their own
distribution, and teams of hundreds. One person can't compete with that, and I'd rather
Talyx be used than sit behind a paywall. So it's free and MIT-licensed. Use it, fork it,
learn from it, build on it.

Petar

## Install

Download the DMG for your Mac from the [latest GitHub release](https://github.com/PetarStoev02/talyx-app/releases/latest):

- Apple Silicon (M1 or newer): [Talyx-arm64.dmg](https://github.com/PetarStoev02/talyx-app/releases/latest/download/Talyx-arm64.dmg)
- Intel: [Talyx-x64.dmg](https://github.com/PetarStoev02/talyx-app/releases/latest/download/Talyx-x64.dmg)

Not sure which Mac you have? Apple menu → About This Mac. "Chip: Apple M…" means Apple Silicon; "Processor: Intel…" means Intel.

Talyx is not notarized by Apple, so macOS blocks it:

1. Open the DMG and drag Talyx to Applications. Then open Talyx. macOS blocks it; dismiss the warning.
2. Go to System Settings → Privacy & Security, scroll down and click **Open Anyway**. macOS asks for your Mac password. Or run once in Terminal: `xattr -dr com.apple.quarantine /Applications/Talyx.app`
3. Every new version you download is blocked the same way the first time you open it.
4. After installing a new version, macOS asks again for Automation and Files & Folders. For Accessibility and Screen Recording, the old Talyx entry stays switched on but stops working: remove it with "−" and add Talyx again.
5. Talyx is not hardened or notarized, so software already running as you could inject code into it. Grant permissions accordingly.

Updates: Talyx checks GitHub for a newer release and opens the release page. It installs nothing itself.

Requirements:

- macOS 13 (Ventura) or newer.
- Voice (dictation and spoken replies) needs Apple Silicon.
- Your own Claude (an Anthropic API key or Claude Code) for the assistant and for Your Claude sorting. Smart Local sorting needs neither.

## Build from source

Node 22.12 or newer (Node 24 matches the Electron runtime).

```bash
npm ci
npm run dev          # Electron + Vite with hot reload
npm test             # unit tests
npm run build:mac    # ad-hoc signed DMGs in dist/, no Apple account needed
```

`npm run dev` downloads Electron the first time it runs. Native modules ship prebuilt binaries, so the same install serves the app, the tests and the MCP server with no rebuild step.

## Privacy

Your files stay on this Mac unless you choose Your Claude for sorting. The network is used only for:

- What you send to Claude when you use the assistant (the conversation and tool results; a screenshot only when you ask it to look at the screen), through your own API key or Claude Code.
- Your Claude sorting, if you turn it on: file names, metadata and the first 2000 characters of extracted text. Common formats of currency amounts and dates, and company names ending in a legal suffix, are masked first on a best-effort basis; anything not recognised, including other names and places, is sent as written.
- Installing Claude Code, if you ask Talyx to.
- Voice models (Whisper and Kokoro), downloaded from Hugging Face when you turn voice on.
- The update check against GitHub (can be set to manual in Settings).

Talyx has no server, no account and no telemetry. Third-party components and model licences are listed in [CREDITS.md](CREDITS.md).

## MCP server

Talyx includes a Model Context Protocol server over stdio, so another AI client such as Claude Desktop or Cursor can operate it. It works on the same database as the app, so launch Talyx once first. Tools: `scan_folder`, `get_file_metadata`, `extract_text`, `classify_files`, `execute_sort`, `undo_sort`, `sort_history`, `search_files`, `watch_folder`.

Run `npm run build`, then point your client at the built server with Node:

```json
{
  "mcpServers": {
    "talyx": {
      "command": "node",
      "args": ["/absolute/path/to/talyx/out/main/mcp/server.js"]
    }
  }
}
```

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, checks and conventions, and [SECURITY.md](SECURITY.md) to report a security issue privately.

## Website

`website/` is [talyx.app](https://talyx.app) (Vite + React):

```bash
cd website && npm ci && npm run build
```

## License

MIT, see [LICENSE](LICENSE). Third-party credits are in [CREDITS.md](CREDITS.md).
