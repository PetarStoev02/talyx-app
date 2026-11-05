/**
 * What the app sends and holds, stated once for every page that shows it. Each line is checkable
 * in the app source: src/main/infrastructure/updater/ and setup/installSteps.ts.
 */
export const PRIVACY_LEDGER = [
  {
    figure: '0',
    caption:
      'Talyx servers or accounts. There is nothing to sign up for, and the app collects no telemetry.'
  },
  {
    figure: '3',
    caption:
      'things the app fetches on its own, all from GitHub: news of a newer release, the installer when you click Download, and the engine’s install steps during setup. Those steps then download the engine.'
  },
  {
    figure: '2',
    caption:
      'checks before anything runs: the installer must match the release’s SHA256SUMS, and the install steps must match a hash built into Talyx.'
  },
  {
    figure: '1',
    caption:
      'place your keys and sign-ins live: the engine on your computer. Talyx hands them over and keeps no copy.'
  }
]

/** The website's own analytics, said plainly wherever the site talks about privacy. */
export const SITE_ANALYTICS =
  'This website counts page views and download clicks with PostHog, hosted in the EU, without cookies.'
