# Privacy policy

**Last Updated:** November 2026

---

## 1. The Short Version

- Talyx has no server, no account and no telemetry. The app sends nothing about you to us.
- Your bots run on the engine, on your computer. What a bot sends goes from the engine to the model provider you set up for it, under that provider's terms. A bot's tools, like web search or a command it runs, can reach other services too. Some ask for your approval first.
- On the internet, Talyx itself reaches only GitHub: to check for a new release, to download an update when you click Download (a deb install updates from the release page instead), and to fetch the engine's install steps. Those steps then download the engine.
- This website counts page views and download clicks with PostHog, hosted in the EU, and measures page speed with Vercel Speed Insights, both without cookies.

---

## 2. What the App Collects

Nothing. Talyx has no server and no account. It collects no usage data and sends no crash reports. We cannot see your bots, your chats, your keys or your settings.

---

## 3. Your Bots and Your Chats

Talyx is a window onto the engine, a separate agent backend that runs your bots on your computer. Talyx talks to the engine over a local connection on your computer.

- **What you send.** Your messages and the images you attach go from Talyx to the engine. When you dictate a message, Talyx sends the recording to the engine, which turns it into text. The engine picks how: with a speech model on your computer, or with a cloud speech-to-text provider you have a key for. In the second case the recording leaves your computer and goes to that provider.
- **Where it goes next.** The engine sends what a bot needs to answer to the model provider that bot uses: the provider of an API key you added, an account you signed in to, or a custom endpoint you set up. What happens there is governed by that provider's terms and privacy policy, not by this policy. Read them before you add a provider.
- **Tools.** A bot's tools, like web search or a command it runs, can reach other services, under those services' terms. Some ask for your approval first, in a card in the chat.
- **Routines and rooms.** Routines run in the engine on their schedule, even while Talyx is closed. Group rooms are hosted by the engine. Both reach your providers the same way.
- **What stays.** The engine keeps your bots and their chats on your computer. Talyx itself sends your chats nowhere else.

### 3.1 The Engine's Own Usage Metrics

The engine has its own anonymous usage metrics. They are off by default, and Talyx never turns them on.

---

## 4. Keys and Sign-ins

When you add an API key or a custom endpoint in Settings, Talyx passes it to the engine over the engine's local API. An account sign-in happens with the provider itself, on its sign-in page in your browser or with its own tool. The engine stores your keys and sign-ins on your computer. Talyx keeps no copy, in its settings or in its log.

---

## 5. What Talyx Downloads

Every download the app makes itself comes from GitHub, from the releases of `PetarStoev02/talyx-app`. GitHub sees each request like any other web request.

- **Release check.** Shortly after launch, and then once a day, Talyx asks GitHub whether a newer release exists.
- **Update download.** When you click Download, Talyx downloads the installer for your computer and the release's `SHA256SUMS`. It checks the installer against `SHA256SUMS`, then opens it for you to run. Talyx never installs anything by itself. A Linux deb install downloads nothing: Talyx links to the release page instead.
- **Engine install steps.** During first-run setup or an engine update, Talyx downloads the release's `engine-install.json` and checks it against a hash built into Talyx. The steps in it then download and install the engine.

A link you click inside Talyx opens in your web browser.

---

## 6. What Stays on Your Computer

- **Talyx's settings,** in a JSON file in the app's data folder: the theme, the sidebar width, where the engine is, the bot or room you had open, whether setup is done and whether Talyx opens at login.
- **Talyx's log,** a file on your computer that helps with troubleshooting.
- **Your bots, chats, keys and sign-ins,** held by the engine.

We have no access to any of these.

---

## 7. This Website

This website counts page views and download clicks with PostHog, hosted in the EU, and measures page speed with Vercel Speed Insights, both without cookies.

- **What it counts.** A page view each time you open a page, a page leave when you go, and one event when you click a link that downloads a Talyx installer, naming the file.
- **What each count carries.** The page's address and title, including any campaign or ad-click tags in the address (such as `utm_source` or `gclid`), the page you came from, your browser, operating system, device type and model, your screen and window size, and your browser's language and time zone. Each page view gets a random ID that lives only in the open page's memory. A page leave also says how long you stayed and how far you scrolled.
- **How.** The counts go to PostHog's EU Cloud in cookieless mode. PostHog sets no cookies and keeps nothing in your browser's storage, so no ID follows you from visit to visit. To count visitors, PostHog's servers compute a privacy-preserving hash. PostHog strips your IP address from these events, so they carry no location derived from it.
- **What is off.** Autocapture of clicks and form fields, session replay, heatmaps, dead-click tracking, surveys, error capture and PostHog's own page-speed measurements.
- **Page speed.** Vercel Speed Insights measures how fast each page loads and responds (Core Web Vitals). Each measurement carries the page's full address (including any campaign tags), your browser, operating system, device type, connection speed and country. It sets no cookies and keeps nothing in your browser's storage.
- **Where.** Only on talyx.app and www.talyx.app. Previews of the site and the live demo on the landing page count nothing.
- **If you block it.** The site and its downloads work the same with PostHog or Speed Insights blocked.

The site remembers your theme choice (light, dark or system) in your browser's local storage, under `talyx-theme`. It is never sent anywhere.

Vercel hosts the site and keeps standard server logs of requests, like any web host.

---

## 8. Your Rights

Talyx holds no data about you. The website's counts carry no name, account, cookie or IP address, so we cannot tell which are yours. We have nothing to access, correct or delete for you. Data you send to your model providers, GitHub, Vercel or PostHog is governed by their policies. Exercise your rights (access, correction, deletion, restriction, portability) with them directly.

---

## 9. Changes

When this policy changes, the new version is posted on this page with a new date.

---

## 10. Contact

Privacy questions: [GitHub Issues](https://github.com/PetarStoev02/talyx-app/issues). Issues are public, so for anything sensitive use a [private security report](https://github.com/PetarStoev02/talyx-app/security/advisories/new).
