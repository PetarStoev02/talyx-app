# Privacy Policy

**Effective Date:** April 2026
**Last Updated:** October 2026

---

## 1. Our Core Privacy Principle

**Talyx is built to give you control over where your data goes, and it defaults to the private option.** File sorting decides which model reads your files under a setting called "Who reads your files," in two options:

- **Smart sorting (default)** — extension and metadata only. No model, no download, no network. Nothing about your files leaves your device, ever.
- **Your Claude (optional)** — sorts the whole batch through your own Claude account (see 2.1 and 2.3).

A fresh install uses Smart sorting. Your Claude is a choice you make in Settings, not the default. The assistant (the hotkey overlay, the Ask page, and voice) is always powered by your own Claude account, and only sends data when you use it (see 2.3). Talyx does not host classification model weights.

---

## 2. Information the App Collects

### 2.1 Files and Documents

**Smart sorting (default):** Classification looks at the file name, extension, size, and metadata embedded in the file or kept by the file system (for example EXIF in photos, tags in audio files, and the title, author and page count of a PDF). It never reads the document text, and nothing is sent anywhere.

**Your Claude (optional):** If you turn this on in Settings and your Claude is reachable, every file in the sort batch may be offered to Anthropic through your own Claude account — names, size, extension, and metadata, plus extracted text when a text extractor could read the file (for example PDFs, Office documents, emails, plain text and HTML). For extracted text: the first 2,000 characters of each file's text. Photos and videos still contribute names and EXIF/metadata under this option; picture or footage bytes themselves are not uploaded as media. A small number of other file types carry their own text: for example, an SVG's title or description, if it has one, is extracted like any document's text and can be sent. Before sending extracted text, Talyx masks currency amounts, dates, and company names ending in a legal suffix. This masking is **best-effort**: it is a pattern-based check for those three kinds of detail, and it does not detect or mask personal names, home addresses, email addresses, phone numbers, or GPS coordinates that may appear in a file's text. Nothing is sent unless you have chosen this option and Claude can be reached; if Claude is unreachable, Smart sorting answers instead. Talyx does not encrypt this text in a way that hides it from Anthropic — the connection to Anthropic is encrypted in transit (TLS), but Anthropic can read the content it receives, the same as with any other request you send it. See 2.3 for whose terms govern that content once it reaches Anthropic.

### 2.2 Voice Model Downloads

If you enable voice, the whisper (speech-to-text) and Kokoro (text-to-speech) models are downloaded from Hugging Face over HTTPS the first time you need them, and then run only on your device. These downloads are for voice only — not for sorting. Sorting never downloads classification weights.

### 2.3 The Assistant (optional), and Your Claude sorting

The assistant (the hotkey overlay, the Ask page, and voice) is powered by **your own Claude**, in one of two ways you choose in Settings, and **Your Claude sorting** (2.1) uses that same connection rather than asking again:

- **Your Anthropic API key.** The key is stored on your device, encrypted by the operating system (macOS Keychain via Electron's `safeStorage`). Requests go directly from your Mac to Anthropic and are billed to your account.
- **Your installed Claude Code.** Talyx drives the `claude` command already signed in on your Mac; requests go through Anthropic on your subscription. Talyx never reads or stores your Claude Code credentials.

If you ask Talyx to install Claude Code for you, it downloads and runs Anthropic's installer from claude.ai (`curl -fsSL https://claude.ai/install.sh | bash`), showing you the command first. This happens only when you ask for it.

When you use the assistant, the following is sent to Anthropic: your instruction, the conversation so far, and the results of the actions the assistant takes to fulfil it — for example a directory listing, the output of a command you approved, or the contents of a file it reads. When you use Your Claude sorting, the file information described in 2.1 is sent instead. Either way, nothing is sent unless you are actively using that feature, and Talyx has no server in this path — it does not see or store your conversations or your files' content.

Anthropic's handling of what it receives is governed by [Anthropic's privacy policy](https://privacy.claude.com) and the terms of your account with them, and it differs by account type. If you use an **Anthropic API key**, that traffic runs under Anthropic's commercial terms, which state that Anthropic may not train models on customer content from its services; how long Anthropic retains it is set out in Anthropic's own terms and Data Processing Addendum rather than here. If you use your **signed-in Claude Code on a Pro or Max subscription**, that traffic runs under Anthropic's consumer terms, the same as a Claude.ai chat — which may be used to improve Anthropic's models if you have allowed that in your Anthropic account's privacy settings. See our [Terms of Service](/legal/terms) (Section 5) for more on which terms apply.

**Voice** is processed on your device: dictation (whisper) and spoken replies (Kokoro or the macOS voice) never send audio anywhere. Only the transcribed text is sent to Anthropic, as part of the assistant conversation described above. Voice is unaffected by your sorting choice.

### 2.4 AI Processing via MCP

Talyx also operates as an MCP (Model Context Protocol) server. When connected to an external AI assistant (Claude Desktop, ChatGPT, Cursor), file metadata and content signals are sent to that AI provider according to their privacy policy.

### 2.5 App Settings

Settings (theme, sort mode, language, AI preferences) are stored locally on your device. We have no access to these settings.

### 2.6 Update Check

Shortly after launch, and then on the schedule you choose in Settings unless you set it to manual, the App asks GitHub's API for the latest release of `PetarStoev02/talyx-app`. GitHub sees the request like any other web request. If a newer version exists, Talyx opens its release page; nothing is installed.

### 2.7 Feedback

Sending feedback opens a new GitHub issue in your browser. The prefilled issue includes the Talyx version and your macOS version, which you can edit before submitting. Issues on GitHub are public, so do not include anything you want to keep private.

---

## 3. Website

The Talyx website has no analytics, no cookies and no forms. It is hosted on Vercel, which logs requests like any web host.

---

## 4. Data Summary

| Data Type                             | Where Processed                            | Stored by Talyx?                  |
| ------------------------------------- | ------------------------------------------ | --------------------------------- |
| File content (Smart sorting, default) | Your device only                           | No                                |
| File content (Your Claude, opt-in)    | Your device, then Anthropic for the batch  | No                                |
| Assistant conversations               | Anthropic, via your own key or Claude Code | No                                |
| Voice audio                           | Your device only                           | No                                |
| Voice models (whisper / Kokoro)       | Your device only                           | No (downloaded from Hugging Face) |
| Claude Code install (only if you ask) | claude.ai                                  | No                                |
| App settings, API key                 | Your device only                           | No                                |
| Update check                          | GitHub                                     | No                                |
| Feedback                              | GitHub Issues (public)                     | No                                |

---

## 5. Your Rights

Talyx holds no data about you: there are no accounts, and no Talyx server stores anything. Your files, settings and API key stay on your device. Data you send to Anthropic, GitHub or Hugging Face is governed by their policies, and you can exercise your rights (access, rectification, deletion, restriction, portability) with them directly. Questions about this policy: [GitHub Issues](https://github.com/PetarStoev02/talyx-app/issues).

---

## 6. Contact

For privacy questions: [GitHub Issues](https://github.com/PetarStoev02/talyx-app/issues). Issues are public, so for anything sensitive use a [private security report](https://github.com/PetarStoev02/talyx-app/security/advisories/new).
