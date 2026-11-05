/** One line of the ledger: a count and what it counts. */
interface LedgerEntry {
  figure: string
  caption: string
  /** The caption cut to one clause for the header menu; null leaves the entry out of the menu. */
  menuCaption: string | null
}

/**
 * What the app sends and holds, stated once for every page that shows it. Each line is checkable
 * in the app source: src/main/infrastructure/updater/ and setup/installSteps.ts.
 */
export const PRIVACY_LEDGER: LedgerEntry[] = [
  {
    figure: '0',
    caption:
      'Talyx servers or accounts. There is nothing to sign up for, and the app collects no telemetry.',
    menuCaption: 'Talyx servers or accounts'
  },
  {
    figure: '1',
    caption:
      'source for everything the app downloads itself: GitHub. That is a check for a newer release, an installer and its SHA256SUMS when you click Download, and the engine’s install steps during setup or an engine update. Those steps then download the engine.',
    menuCaption: 'source for everything the app downloads itself: GitHub'
  },
  {
    figure: '2',
    caption:
      'checks before anything runs: the installer must match the release’s SHA256SUMS, and the install steps must match a hash built into Talyx.',
    menuCaption: null
  },
  {
    figure: '1',
    caption:
      'place your keys and sign-ins live: the engine on your computer. Talyx hands them over and keeps no copy.',
    menuCaption: 'place your keys and sign-ins live: the engine on your computer'
  }
]

/** The website's own analytics, said plainly wherever the site talks about privacy. */
export const SITE_ANALYTICS =
  'This website counts page views and download clicks with PostHog, hosted in the EU, without cookies.'
