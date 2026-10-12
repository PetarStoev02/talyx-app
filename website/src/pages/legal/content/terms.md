# Terms of Service

**Effective Date:** March 2026
**Last Updated:** October 2026

---

## 1. Acceptance

By downloading, installing, or using Talyx ("the App"), you agree to these Terms of Service.

---

## 2. Licence

Talyx is free and open source under the MIT licence. The full text is in the [LICENSE file](https://github.com/PetarStoev02/talyx-app/blob/main/LICENSE) in the source repository. There is nothing to buy and nothing to activate, and no account is needed.

The optional assistant and the optional Your Claude sorting mode run on your own Claude account. Any usage charges are between you and Anthropic (see 5.1 and 5.3).

Talyx is available for macOS only (Apple Silicon and Intel). Voice features require Apple Silicon.

---

## 3. Installation

Talyx is not notarized by Apple; it is ad-hoc signed. You download and install it yourself from [GitHub Releases](https://github.com/PetarStoev02/talyx-app/releases/latest).

macOS blocks each downloaded version the first time you open it. Try to open it, dismiss the warning, then go to System Settings → Privacy & Security and choose **Open Anyway** (macOS asks for your Mac password). Or run `xattr -dr com.apple.quarantine /Applications/Talyx.app` in Terminal.

After you install a new version, the Automation and Files & Folders prompts return. The Accessibility and Screen Recording entries stay switched on but stop working: remove Talyx with "−" and add it again.

**Security note:** Talyx is not hardened or notarized, so software already running as you could inject code into it. Grant permissions accordingly.

Talyx checks GitHub for a newer version and opens the release page. It installs nothing by itself.

---

## 4. Intellectual Property

The source code is released under the MIT licence (Section 2). The Talyx name and logo are not licensed for use in other products or to suggest that they are endorsed by or affiliated with Talyx.

---

## 5. Data Processing

### 5.1 Who Reads Your Files

Sorting is controlled by a setting you choose in the App, with two options:

- **Smart sorting (default):** classification looks at file names, extensions, size, and embedded metadata such as EXIF — never the document text. Nothing is sent anywhere.
- **Your Claude (opt-in):** when Claude is reachable, the whole sort batch may be sent to Anthropic through your own Claude account, as described in Section 5.3 and in our [Privacy Policy](/legal/privacy).

A fresh install uses Smart sorting. Choosing Your Claude is your decision, made in Settings, and can be changed at any time. Talyx does not host classification model weights.

### 5.2 Smart Local Mode

Extension-based classification and metadata extraction run entirely on your device. No data is sent externally.

### 5.3 The Assistant, and Your Claude Sorting

The assistant is optional and is powered by your own Claude: either an Anthropic API key you enter, or the Claude Code installation already signed in on your Mac. Choosing **Your Claude** for sorting (5.1) uses that same connection. By using either you agree that the relevant content — for the assistant, your instructions, the conversation, and the results of the actions it takes; for Your Claude sorting, the file information described in our [Privacy Policy](/legal/privacy) — is sent to Anthropic under your agreement with them. You are responsible for any usage charges on your Anthropic account and for keeping your API key confidential.

Which of Anthropic's terms govern that content depends on how you connect your Claude:

- **Anthropic API key:** governed by [Anthropic's commercial terms](https://www.anthropic.com/legal/commercial-terms) and Anthropic's Data Processing Addendum, which state that Anthropic may not train models on customer content from its services. For how long Anthropic retains that content, and for any arrangement about retention, read Anthropic's own terms and Data Processing Addendum — Talyx cannot state those on Anthropic's behalf.
- **Signed-in Claude Code on a Pro or Max subscription:** governed by [Anthropic's consumer terms](https://www.anthropic.com/legal/consumer-terms) and consumer privacy policy, the same as a Claude.ai chat — including that Anthropic may use that content to improve its models if you have allowed that in your Anthropic account's privacy settings.

Talyx is not a party to your agreement with Anthropic and cannot change these terms on your behalf; read Anthropic's current terms and privacy policy before relying on any of the above.

The assistant proposes actions and Talyx carries them out on your device. Actions that change your files or system state are shown to you first and run only after you approve them in the App; read-only actions may run without asking. You are responsible for reviewing what you approve.

---

## 6. Limitation of Liability

Talyx is provided "as is", without warranty of any kind, express or implied, including the warranties of merchantability, fitness for a particular purpose and non-infringement, as set out in the MIT licence. In no event are the authors liable for any claim, damages or other liability arising from the use of the App, including data loss or the consequences of actions the assistant performs on your instructions. Always maintain backups of your files.

---

## 7. Privacy

See our [Privacy Policy](/legal/privacy) for how data flows between Talyx, your device, GitHub, Hugging Face and your chosen AI provider. Talyx has no server of its own.

---

## 8. Contact

Questions about these terms, bugs and ideas: [GitHub Issues](https://github.com/PetarStoev02/talyx-app/issues). Issues are public.

Security problems: [report privately on GitHub](https://github.com/PetarStoev02/talyx-app/security/advisories/new).
