import { useState } from 'react'
import { ApprovalCard } from '../../../shared/ui/ApprovalCard'
import { EXAMPLE_ASKS, planFor } from './plans'

/** The page's one live thing: type a request, see the card Talyx would show. */
export function TryItSection() {
  const [ask, setAsk] = useState(EXAMPLE_ASKS[0])
  const plan = planFor(ask)

  return (
    <section id="try" className="bg-[var(--color-bg-secondary)] px-5 py-32 sm:px-8 md:py-40">
      <h2
        data-reveal
        className="leading-none font-semibold tracking-[-0.035em] text-[var(--color-text-primary)]"
        style={{ fontSize: 'var(--step-heading)' }}
      >
        Ask it something.
      </h2>

      <label
        data-reveal
        className="mt-12 flex items-baseline"
        style={{ '--i': 1 } as React.CSSProperties}
      >
        <span className="sr-only">Your request</span>
        <input
          data-ui
          value={ask}
          onChange={(e) => setAsk(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          className="w-full min-w-0 bg-transparent leading-none font-semibold tracking-[-0.045em] text-[var(--color-text-primary)] caret-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)] focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-[0.15em]"
          style={{ fontSize: 'var(--step-display)' }}
          placeholder="type a request"
        />
      </label>

      <div className="mt-12 grid gap-10 md:grid-cols-12">
        <div className="md:col-span-7" aria-live="polite">
          <ApprovalCard key={plan.summary} plan={plan} />
        </div>
        <div className="md:col-span-5">
          <p className="text-[var(--color-text-primary)]" style={{ fontSize: 'var(--step-body)' }}>
            Changes wait for Approve. Reads, like finding a file, run straight away. These are
            sample plans; the real ones come from your Claude.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {EXAMPLE_ASKS.map((example) => (
              <li key={example}>
                <button
                  type="button"
                  onClick={() => setAsk(example)}
                  className="min-h-11 rounded-full bg-[var(--color-bg)] px-4 text-[15px] font-medium text-[var(--color-text-primary)] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
                >
                  {example}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
