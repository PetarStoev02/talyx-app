# Credits

Talyx is licensed under AGPL-3.0 (see `LICENSE`). It is built on and ships with the following. Their
licences, not Talyx's, govern them.

## Shipped inside the app

| Component                                                                             | Licence     | Notes                                                                                            |
| ------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------ |
| [Electron](https://www.electronjs.org/)                                               | MIT         | App runtime                                                                                      |
| [React](https://react.dev/)                                                           | MIT         | Interface                                                                                        |
| [Radix UI](https://www.radix-ui.com/)                                                 | MIT         | Interface primitives                                                                             |
| [Lucide](https://lucide.dev/)                                                         | ISC         | Icons                                                                                            |
| [Geist and Geist Mono](https://github.com/vercel/geist-font)                          | SIL OFL 1.1 | Fonts; licence in `src/renderer/src/assets/fonts/OFL.txt`                                        |
| The engine's desktop client (protocol client, API wrappers, gateway attach), vendored | MIT         | Licence in `src/renderer/src/shared/engine/LICENSE` and `src/main/infrastructure/engine/LICENSE` |

The full list of npm dependencies and their licences is in `package-lock.json`.
