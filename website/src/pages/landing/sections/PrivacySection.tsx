import { REPO_URL } from '../../../shared/data/release'
import { PRIVACY_LEDGER, SITE_ANALYTICS } from '../../../shared/data/privacy'
import { STEP, stagger } from '../../../shared/ui/page'

/** Privacy as a ledger: the few numbers that say what leaves the computer. */
export function PrivacySection() {
  return (
    <section id="privacy" className="grid gap-16 px-5 py-32 sm:px-8 md:grid-cols-12 md:py-48">
      <div className="md:sticky md:top-32 md:col-span-5 md:self-start">
        <h2
          data-reveal
          className="leading-none font-semibold tracking-[-0.035em]"
          style={STEP.heading}
        >
          <span className="block text-[var(--color-text-secondary)]">Where your</span>
          <span className="block text-[var(--color-text-primary)]">chats go.</span>
        </h2>
        <p
          data-reveal
          className="mt-8 max-w-[40ch] leading-relaxed text-[var(--color-text-primary)]"
          style={{ ...stagger(1), ...STEP.body }}
        >
          Each bot sends them to the model provider it uses, under that provider’s terms. A bot’s
          tools, like web search, can reach other services too. Talyx sends them nowhere else.
        </p>
      </div>

      <div className="md:col-span-7">
        <dl className="space-y-10 md:space-y-12">
          {PRIVACY_LEDGER.map(({ figure, counted, detail }, i) => (
            <div
              key={counted}
              data-reveal
              style={stagger(i)}
              className="grid grid-cols-[minmax(0,3fr)_minmax(0,7fr)] md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-baseline gap-6"
            >
              <dt
                className="text-right leading-none font-semibold tracking-[-0.04em] tabular-nums text-[var(--color-text-primary)]"
                style={STEP.heading}
              >
                {figure}
              </dt>
              <dd className="text-[var(--color-text-primary)]" style={STEP.body}>
                <span className="font-semibold">{counted}.</span> {detail}
              </dd>
            </div>
          ))}
        </dl>
        {/* On the ledger's grid, so the note starts on the captions' left edge. */}
        <div className="mt-16 md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-6">
          <p
            className="max-w-[56ch] text-[var(--color-text-primary)] md:col-start-2"
            style={STEP.body}
          >
            {SITE_ANALYTICS} The app counts nothing. Every line above can be checked in the source.{' '}
            <a
              href={REPO_URL}
              className="font-medium underline underline-offset-4 transition-opacity hover:opacity-70"
            >
              Read the code on GitHub
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}
