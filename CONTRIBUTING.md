# Contributing to Talyx

Thanks for wanting to help. Bug reports, ideas and pull requests are all welcome.

## Before you start

- **Bugs and ideas:** open an [issue](https://github.com/PetarStoev02/talyx-app/issues). For a bug, say what you did, what you expected and what happened, plus your macOS version and Mac (Apple Silicon or Intel).
- **Security problems:** do not open a public issue. See [SECURITY.md](SECURITY.md).
- **Bigger changes:** open an issue first so we can agree on the approach before you spend time on it.

## Set up

Talyx is macOS only. You need macOS 13 or newer and Node 22.12 or newer (Node 24 matches the Electron runtime). Voice needs Apple Silicon.

```bash
npm ci
npm run dev          # Electron + Vite with hot reload
npm test             # unit tests (Vitest)
npm run build:mac    # ad-hoc signed DMGs in dist/
```

`npm run dev` downloads Electron the first time. `npm run reset` deletes your local Talyx data (database and settings) so the app starts from the welcome screen; `npm run dev:reset` does that and starts the app.

During `npm run dev` the interface also runs in a browser at `http://localhost:5173`, connected to the real app.

## Making a change

1. Fork the repo and create a branch named `type/short-description`, for example `fix/undo-skips-renamed-files`.
2. Make the change. Follow the architecture and conventions in [CLAUDE.md](CLAUDE.md): domain logic in `src/main/domain/` with no Electron imports, IPC handlers kept thin, and the renderer's Feature-Sliced layers.
3. Add or update tests in `tests/unit/` for the behaviour you changed.
4. Run the checks CI runs:

   ```bash
   npm run lint && npm run typecheck && npm test
   ```

5. Format with `npm run format` (Prettier: single quotes, no semicolons, 100 columns).
6. Commit in the form `type: imperative description`, for example `fix: keep undo from overwriting a file`. Types: `feat`, `fix`, `docs`, `refactor`, `chore`, `ci`, `test`.
7. Open a pull request against `main`. Say what it changes and how you tested it. CI must pass before it is merged.

## Good to know

- Anything that changes something on the user's Mac goes through the approval card. New abilities live in `src/main/domain/instruction/capabilities/` and must declare their effect so the approval gate can ask first.
- Smart Local sorting never touches the network. Keep it that way.
- The website lives in `website/` (`cd website && npm ci && npm run dev`).

By contributing you agree that your work is released under the [MIT License](LICENSE) and that you follow the [Code of Conduct](CODE_OF_CONDUCT.md).
