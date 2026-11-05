# Terms of service

**Last Updated:** November 2026

---

## 1. Acceptance

By downloading, installing or using Talyx ("the App"), you agree to these Terms of Service.

---

## 2. Licence

Talyx is free and open source under the MIT licence. The full text is in the [LICENSE file](https://github.com/PetarStoev02/talyx-app/blob/main/LICENSE) in the source repository. There is nothing to buy, nothing to activate and no account to create.

Your bots run on models from providers you choose. Any charges from those providers are between you and them (see Section 5).

Talyx 1.0 runs on macOS 13 or newer (Apple Silicon and Intel) and on Linux x64. Windows comes later.

---

## 3. Installation and Updates

No build of Talyx is signed or notarized. You download it yourself from [GitHub Releases](https://github.com/PetarStoev02/talyx-app/releases/latest).

On macOS, the system blocks each downloaded version the first time you open it. Open Talyx and dismiss the warning, then go to System Settings → Privacy & Security and click **Open Anyway** (macOS asks for your password). Or run `xattr -dr com.apple.quarantine /Applications/Talyx.app` once in Terminal. Linux shows no warning.

**Security note:** Talyx is not hardened or notarized, so software already running as you could change how it behaves. Keep that in mind before you add keys and sign-ins.

Talyx checks GitHub for a newer release. When you click Download, it downloads the installer for your computer, checks it against the release's `SHA256SUMS` and opens it for you to run. It never installs an update by itself. A Linux deb install updates from the release page instead.

---

## 4. The Engine

Your bots run on the engine, a separate agent backend. Talyx's first-run setup installs it for your user only, using install steps that Talyx checks against a hash built into it. Talyx uses the engine as it ships and does not change it. Your use of the engine is also subject to the engine's own licence.

---

## 5. Your Bots and Model Providers

Each bot sends its conversations to the model provider you set up for it: an API key, an account sign-in or a custom endpoint. That content is sent under your agreement with that provider, as described in our [Privacy Policy](/legal/privacy). Talyx is not a party to that agreement and cannot change it. Read each provider's terms and privacy policy before you add it.

You are responsible for any charges on your provider accounts and for keeping your keys confidential.

Bots can take actions on your computer through the engine. Some actions ask for your approval first, in a card in the App. Routines run on their schedule, without you starting them. You are responsible for what you approve and for what your bots and routines do.

---

## 6. Intellectual Property

The source code is released under the MIT licence (Section 2). The Talyx name and logo are not licensed for use in other products, or to suggest that a product is endorsed by or affiliated with Talyx.

---

## 7. Limitation of Liability

Talyx is provided "as is", without warranty of any kind, express or implied, including the warranties of merchantability, fitness for a particular purpose and non-infringement, as set out in the MIT licence. In no event are the authors liable for any claim, damages or other liability arising from the use of the App, including data loss, provider charges, or the consequences of actions your bots take. Keep backups of your files.

---

## 8. Privacy

See our [Privacy Policy](/legal/privacy) for how data moves between Talyx, the engine, your model providers and GitHub, and for what this website counts. Talyx has no server of its own.

---

## 9. Contact

Questions about these terms, bugs and ideas: [GitHub Issues](https://github.com/PetarStoev02/talyx-app/issues). Issues are public.

Security problems: [report them privately on GitHub](https://github.com/PetarStoev02/talyx-app/security/advisories/new).
