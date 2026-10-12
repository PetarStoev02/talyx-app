# Credits

Talyx is MIT-licensed (see `LICENSE`). It is built on, ships with, or downloads the
following. Their licences, not Talyx's, govern them.

## Shipped inside the app

| Component                                                                                      | Licence                                     | Notes                                                                                      |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [Electron](https://www.electronjs.org/)                                                        | MIT                                         | App runtime                                                                                |
| [React](https://react.dev/)                                                                    | MIT                                         | Interface                                                                                  |
| [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)                                   | MIT                                         | Local database                                                                             |
| [onnxruntime-node](https://onnxruntime.ai/)                                                    | MIT                                         | Runs the voice models on this Mac                                                          |
| [Transformers.js](https://github.com/huggingface/transformers.js)                              | Apache-2.0                                  | Loads the voice models                                                                     |
| [phonemizer](https://www.npmjs.com/package/phonemizer)                                         | Apache-2.0, bundles **eSpeak NG (GPL-3.0)** | Pronunciation for spoken replies. eSpeak NG source: https://github.com/espeak-ng/espeak-ng |
| [sharp](https://sharp.pixelplumbing.com/) with libvips                                         | Apache-2.0 / LGPL-3.0                       | Image handling. libvips source: https://github.com/libvips/libvips                         |
| [@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-typescript)                    | MIT                                         | Talks to Claude with your API key                                                          |
| [@anthropic-ai/claude-agent-sdk](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) | Anthropic's terms                           | Talks to your installed Claude Code; not covered by Talyx's MIT licence                    |
| [Model Context Protocol SDK](https://github.com/modelcontextprotocol/typescript-sdk)           | MIT                                         | Talyx's MCP server                                                                         |
| [Lucide](https://lucide.dev/)                                                                  | ISC                                         | Icons                                                                                      |
| [Geist and Geist Mono](https://github.com/vercel/geist-font)                                   | SIL OFL 1.1                                 | Fonts; licence in `src/renderer/src/assets/fonts/OFL.txt`                                  |

The full list of npm dependencies and their licences is in `package-lock.json`.

## Downloaded on first use

| Model                                 | Licence      | Source                                                                                                |
| ------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------- |
| Whisper base / small (ONNX)           | MIT (OpenAI) | `onnx-community/whisper-base`, `onnx-community/whisper-small` on Hugging Face, when you turn voice on |
| Kokoro-82M v1.0 (ONNX) and its voices | Apache-2.0   | `onnx-community/Kokoro-82M-v1.0-ONNX` on Hugging Face, when you turn voice on                         |

Your files stay on this Mac unless you choose "Your Claude" for sorting, which sends file names, metadata and up to the first 2000 characters of text (common formats of currency amounts and dates, and company names ending in a legal suffix such as Ltd, Inc or ООД, are masked on a best-effort basis; anything not recognised, including other names and places, is sent as written) to Claude. Otherwise the network is used only for: what you send to Claude when you use the assistant; installing Claude Code if you ask Talyx to; the downloads above; and the update check.
