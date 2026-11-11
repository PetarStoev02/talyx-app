# Contributing to Talyx

Thanks for wanting to help. Bug reports, ideas and pull requests are all welcome.

## Before you start

- **Bugs and ideas:** open an [issue](https://github.com/PetarStoev02/talyx-app/issues). For a bug, say what you did, what you expected and what happened, plus your operating system and version.
- **Security problems:** do not open a public issue. See [SECURITY.md](SECURITY.md).
- **Bigger changes:** open an issue first so we can agree on the approach before you spend time on it.

## Set up

You need Node 22.12 or newer (Node 24 matches the Electron runtime). Talyx 1.0 runs on macOS 13 or newer and Linux (x64). Windows comes once the engine runs there.

```bash
npm ci
npm run dev          # Electron + Vite with hot reload
npm test             # unit tests (Vitest)
npm run build:mac    # DMGs in dist/; unsigned unless a Developer ID is set up
```

`npm run dev` downloads Electron the first time. `npm run reset` deletes your local Talyx settings; `npm run dev:reset` does that and starts the app.

During `npm run dev` the interface also runs in a browser at `http://localhost:5173`, connected to the real app.

## Making a change

1. Fork the repo and create a branch named `type/short-description`, for example `fix/sidebar-loses-state`.
2. Make the change. Follow the architecture and conventions in [CLAUDE.md](CLAUDE.md): IPC handlers kept thin, input validated at the IPC boundary, and the renderer's Feature-Sliced layers.
3. Add or update tests in `tests/unit/` for the behaviour you changed.
4. Run the checks CI runs:

   ```bash
   npm run lint && npm run typecheck && npm test
   ```

5. Format with `npm run format` (Prettier: single quotes, no semicolons, 100 columns).
6. Commit in the form `type: imperative description`, for example `fix: keep the sidebar state across restarts`. Types: `feat`, `fix`, `docs`, `refactor`, `chore`, `ci`, `test`.
7. Open a pull request against `main`. Say what it changes and how you tested it, and tick the contributor agreement box. CI must pass before it is merged.

## Good to know

- Talyx is a client of the agent engine. Orchestration (bot-to-bot messages, group rooms, routines) belongs in the engine, not in the app.
- The website lives in `website/` (`cd website && npm ci && npm run dev`).

## Licence and the contributor agreement

Talyx is released under the [AGPL-3.0 licence](LICENSE), and your contribution is published under it too. Before a pull request can be merged, you also agree to the [Contributor Licence Agreement](CLA.md) by ticking its box in the pull request. It lets the maintainer license your contribution on other terms as well, which the closed-source Talyx modules need. You keep the copyright in your work.

By contributing you also agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
