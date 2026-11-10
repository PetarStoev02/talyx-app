import { Link } from '@tanstack/react-router'
import { GUTTER, PageHero, STEP, stagger } from '../../shared/ui/page'

const PLANS = [
  {
    name: 'Talyx',
    price: 'Free',
    detail:
      'The agents app: bots, chat, rooms, routines and the manager. Open source under AGPL-3.0, for good.'
  },
  {
    name: 'Workflows',
    price: '$47 one-time',
    detail: 'The Workflows module. Every later update is included.'
  },
  {
    name: 'Talyx Pro',
    price: '$92 one-time',
    detail: 'Every Talyx module, including the ones still to come. Every later update is included.'
  }
]

export function PricingPage() {
  return (
    <>
      <PageHero
        title="Pricing"
        lead="Talyx is free. Modules add new kinds of work on top, and you pay for them once."
      />

      <section className={`${GUTTER} grid gap-16 pb-16 md:grid-cols-12 md:gap-10`}>
        {PLANS.map(({ name, price, detail }, i) => (
          <div key={name} data-reveal className="md:col-span-4" style={stagger(i)}>
            <h2
              className="leading-none font-semibold tracking-[-0.035em] text-[var(--color-text-primary)]"
              style={STEP.heading}
            >
              {name}
            </h2>
            <p className="mt-6 font-semibold text-[var(--color-text-primary)]" style={STEP.lead}>
              {price}
            </p>
            <p className="mt-4 max-w-[36ch] text-[var(--color-text-primary)]" style={STEP.body}>
              {detail}
            </p>
          </div>
        ))}
      </section>

      <section
        className={`${GUTTER} pb-32 text-[var(--color-text-secondary)] md:pb-48`}
        style={STEP.small}
      >
        <p className="max-w-[65ch]">
          Prices in US dollars; tax is added at checkout where it applies. Orders are processed by
          Paddle.com, our Merchant of Record. 30-day refunds: see the{' '}
          <Link to="/legal/$slug" params={{ slug: 'refund' }} className="underline">
            refund policy
          </Link>
          .
        </p>
      </section>
    </>
  )
}
