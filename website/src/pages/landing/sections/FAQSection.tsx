import { faqEntries } from '../../../shared/data/seo'
import { SectionHeading, STEP, stagger } from '../../../shared/ui/page'

/** A wide heading, the questions indented under it. */
export function FAQSection() {
  return (
    <section id="faq" className="px-5 py-32 sm:px-8 md:py-48">
      <SectionHeading>Before you download.</SectionHeading>

      <div className="mt-20 grid md:grid-cols-12">
        <div className="space-y-3 md:col-span-8 md:col-start-5">
          {faqEntries.map(({ q, a }, i) => (
            <details
              key={q}
              data-reveal
              style={stagger(i)}
              className="group -mx-5 rounded-none px-5 py-4 open:bg-[var(--color-bg-secondary)] md:-mx-6 md:rounded-xl md:px-6"
            >
              <summary
                className="flex cursor-pointer list-none items-center justify-between gap-6 leading-snug font-medium text-[var(--color-text-primary)] transition-opacity hover:opacity-70 [&::-webkit-details-marker]:hidden"
                style={STEP.lead}
              >
                {q}
                <span
                  aria-hidden="true"
                  className="size-3 shrink-0 rotate-45 border-r-2 border-b-2 border-current transition-transform duration-200 group-open:-rotate-135"
                />
              </summary>
              <p
                className="mt-4 max-w-[52ch] leading-relaxed text-[var(--color-text-primary)]"
                style={STEP.body}
              >
                {a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
