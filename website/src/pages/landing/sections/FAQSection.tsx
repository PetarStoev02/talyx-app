import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { faqEntries } from '../../../shared/data/seo'

interface FAQ {
  q: string
  a: string
}

const faqs: FAQ[] = faqEntries

function FAQItem({ q, a, index }: FAQ & { index: number }) {
  const [open, setOpen] = useState(false)
  const answerId = `faq-answer-${index}`

  return (
    <div className="border-b border-[var(--color-border)]">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={answerId}
        className="flex w-full items-center justify-between py-5 text-left text-[15px] font-medium text-[var(--color-text-primary)] transition-colors hover:text-[var(--color-text-secondary)]"
      >
        {q}
        <ChevronDown
          className={`size-4 shrink-0 text-[var(--color-text-tertiary)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <p
          id={answerId}
          className="pb-5 text-sm leading-relaxed text-[var(--color-text-secondary)]"
        >
          {a}
        </p>
      )}
    </div>
  )
}

export function FAQSection() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-[700px]">
        <h2 className="mb-2 text-center text-[24px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)] sm:text-[32px]">
          The six things people ask before downloading
        </h2>
        <p className="mb-10 text-center text-sm text-[var(--color-text-secondary)]">
          Straight answers. No sales copy.
        </p>

        <div>
          {faqs.map((faq, i) => (
            <FAQItem key={faq.q} {...faq} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
