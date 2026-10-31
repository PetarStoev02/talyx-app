# Talyx Office

Talyx Office is my personal macOS app: it shows my Grok Bots and T3 Code work as a live 3D office. Each bot is a character, each group chat is a room, and where a bot stands tells you what it is doing. I can also hand a bot a task from the office. It is built for my own Mac, Tailscale, T3 Code install and bots; it is not a general product (the `website/` folder is left over from the old Talyx and not maintained).

Grok Bots have no read API, so Talyx shows what the bots report to it, plus real T3 Code threads read from this Mac. A bot is drawn stale after `staleMinutes` (default 15) without a signal, not as working.

## Requirements

- macOS 13 or newer, Node 22.12+
- T3 Code installed (`~/.t3/bin/t3`)
- [Tailscale](https://tailscale.com) with **Funnel enabled** for the tailnet (the tailnet admin turns it on first)
- Grok Bots with routines that have a webhook trigger

## Run

```bash
npm ci
env -u ELECTRON_RUN_AS_NODE npm run dev   # the shell may set ELECTRON_RUN_AS_NODE
npm run build:mac                         # DMG (ad-hoc signed, not notarized)
```

Closing the window keeps Talyx running in the menu bar. `npm run reset` clears the local data (database, settings, secrets, logos); the AgroOps roster is seeded again on the next start.

## First setup

1. Open Settings and turn on **Funnel**. Talyx listens on `127.0.0.1:47321` and Tailscale Funnel publishes it. Endpoints: `POST /events` (bots), `POST /t3/events` (T3), `GET /health`, all with a Bearer token.
2. For each bot, copy its generated instructions from Settings into the bot. They tell the bot to report to your Funnel URL with the token.
3. For each bot, paste its routine webhook URL (https only) and key. This is how tasks go out from the office.

T3 Code is read with `t3 thread list|show --json`, and project names read-only from `~/.t3/userdata/statev2.sqlite`. Threads are started or messaged with `t3 thread start|send`.

## Security

- The inbound token and the webhook keys are kept in Electron `safeStorage` (encrypted files in the app data folder). They never reach the renderer, logs or git.
- The endpoint is bound to localhost and reachable from outside only through Tailscale Funnel; every request needs the Bearer token. Rotate the token in Settings.
- Talyx is ad-hoc signed and not notarized: macOS blocks the first open (System Settings → Privacy & Security → Open Anyway, or `xattr -dr com.apple.quarantine /Applications/Talyx.app`).

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, checks and conventions, and [SECURITY.md](SECURITY.md) to report a security issue privately.

`website/` is left over from the old Talyx and unmaintained.

## License

MIT, see [LICENSE](LICENSE). Third-party credits are in [CREDITS.md](CREDITS.md).
