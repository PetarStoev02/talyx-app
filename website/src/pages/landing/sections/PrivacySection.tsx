import { REPO_URL } from '../../../shared/data/release'

const LEDGER = [
  {
    figure: '0',
    caption: 'bytes leave your Mac when Smart Local sorts. It is the default.'
  },
  {
    figure: '0',
    caption:
      'Talyx servers, accounts or analytics. Settings and history stay in a local SQLite file.'
  },
  {
    figure: '2,000',
    caption:
      'characters per file at most when you choose Your Claude, with amounts, dates and company names masked first.'
  },
  {
    figure: '1',
    caption:
      'update check, to GitHub. Talyx opens the release page and never installs anything itself.'
  }
]

/** Privacy as a ledger: the few numbers that say what leaves the machine. */
export function PrivacySection() {
  return (
    <section id="privacy" className="grid gap-16 px-5 py-32 sm:px-8 md:grid-cols-12 md:py-48">
      <div className="md:sticky md:top-32 md:col-span-5 md:self-start">
        <h2
          data-reveal
          className="leading-none font-semibold tracking-[-0.035em]"
          style={{ fontSize: 'var(--step-heading)' }}
        >
          <span className="block text-[var(--color-text-secondary)]">What leaves</span>
          <span className="block text-[var(--color-text-primary)]">your Mac.</span>
        </h2>
        <p
          data-reveal
          className="mt-8 max-w-[40ch] leading-relaxed text-[var(--color-text-primary)]"
          style={{ '--i': 1, fontSize: 'var(--step-body)' } as React.CSSProperties}
        >
          The assistant sends your conversation to your own Claude, through your API key or the
          Claude Code you are signed into. A screenshot goes only when you ask it to look.
        </p>
      </div>

      <div className="md:col-span-7">
        <dl className="space-y-10 md:space-y-12">
          {LEDGER.map(({ figure, caption }, i) => (
            <div
              key={caption}
              data-reveal
              style={{ '--i': i } as React.CSSProperties}
              className="grid grid-cols-[minmax(0,3fr)_minmax(0,7fr)] md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-baseline gap-6"
            >
              <dt
                className="text-right leading-none font-semibold tracking-[-0.04em] tabular-nums text-[var(--color-text-primary)]"
                style={{ fontSize: 'var(--step-heading)' }}
              >
                {figure}
              </dt>
              <dd
                className="text-[var(--color-text-primary)]"
                style={{ fontSize: 'var(--step-body)' }}
              >
                {caption}
              </dd>
            </div>
          ))}
        </dl>
        <p
          className="mt-16 text-[var(--color-text-primary)]"
          style={{ fontSize: 'var(--step-body)' }}
        >
          Every one of these can be checked in the source.{' '}
          <a
            href={REPO_URL}
            className="font-medium underline underline-offset-4 transition-opacity hover:opacity-70"
          >
            Read the code on GitHub
          </a>
        </p>
      </div>
    </section>
  )
}
