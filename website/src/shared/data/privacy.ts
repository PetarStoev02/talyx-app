/** One line of the ledger: a count, what it counts and the detail behind it. */
interface LedgerEntry {
  figure: string
  /** Read straight after the figure, so the figure is a count: "0 Talyx servers or accounts behind the free app". */
  counted: string
  detail: string
  /** Whether the header menu lists this entry, with its counted phrase alone. */
  inMenu: boolean
}

/**
 * What the app sends and holds, stated once for every page that shows it. Each line is checkable
 * in the app source: src/main/infrastructure/updater/ and setup/installSteps.ts.
 */
export const PRIVACY_LEDGER: LedgerEntry[] = [
  {
    figure: '0',
    counted: 'Talyx servers or accounts behind the free app',
    detail: 'There is nothing to sign up for, and the app collects no telemetry.',
    inMenu: true
  },
  {
    figure: '1',
    counted: 'source for everything the app downloads itself: GitHub',
    detail:
      'That is a check for a newer release, the update itself with its checksums, and the engine’s install steps during setup or an engine update. Those steps then download the engine.',
    inMenu: true
  },
  {
    figure: '2',
    counted: 'checks before anything runs',
    detail:
      'The update must match the release’s checksums, and the install steps must match a hash built into Talyx.',
    inMenu: false
  },
  {
    figure: '1',
    counted: 'place your keys and sign-ins live: the engine on your computer',
    detail: 'Talyx hands them over and keeps no copy.',
    inMenu: true
  }
]

/** The website's own analytics, said plainly wherever the site talks about privacy. */
export const SITE_ANALYTICS =
  'This website counts page views and download clicks with PostHog, hosted in the EU, and measures page speed with Vercel Speed Insights, both without cookies.'
