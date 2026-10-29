import { ArrowRight } from 'lucide-react'
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle'
import { useNoIndex } from '../../shared/hooks/useNoIndex'
import { ApprovalCard } from '../../shared/ui/ApprovalCard'
import {
  AppScreenshot,
  Body,
  GUTTER,
  ItemTitle,
  PageHero,
  SectionHeading
} from '../../shared/ui/page'

const TYPE_STEPS = [
  { token: '--step-display', use: 'Page titles and the closing headline', sample: 'Tell your Mac' },
  {
    token: '--step-heading',
    use: 'Section headings and ledger figures',
    sample: 'What leaves your Mac.'
  },
  {
    token: '--step-lead',
    use: 'The sentence under a title, item titles',
    sample: 'Your own Claude does it once you approve the card.'
  },
  {
    token: '--step-body',
    use: 'Running text, always in full ink',
    sample: 'Every sort is recorded. Put one file or a whole batch back exactly where it came from.'
  },
  {
    token: '--step-small',
    use: 'Meta lines and notes only',
    sample: 'v0.11.0 · macOS 13 or newer · 249 MB'
  }
]

const COLOURS = [
  { token: '--color-bg', use: 'Ground' },
  { token: '--color-bg-secondary', use: 'One tone step: bands, panels, open rows' },
  { token: '--color-text-primary', use: 'Ink, and the inverted close' },
  { token: '--color-text-secondary', use: 'Notes and meta only' },
  { token: '--color-btn-primary-bg', use: 'The one action' }
]

const RULES = [
  'Headlines fit two lines at every width.',
  'No icon cards, eyebrows, hairlines, gradients, glass or resting shadows.',
  'Surfaces separate by a tone step, never a line.',
  'Running text is 16px or more, in full ink.',
  'One button shape: the full pill.',
  'Pictures are the real app, or the Mac wallpaper it runs on.'
]

const SAMPLE_PLAN = {
  summary: 'Sort 47 files in Downloads into 6 folders',
  steps: ['12 invoices → Documents/Invoices', '21 screenshots → Images/Screenshots'],
  needsApproval: true
}

/** The site's design system on one unlisted page. Not linked anywhere and not indexed. */
export function DesignPage() {
  useDocumentTitle('Design')
  useNoIndex()

  return (
    <>
      <PageHero
        title="Design"
        lead="The parts the Talyx site is built from: five type steps, one ground, one ink, one action, and the real app as the picture."
      >
        <ul
          className="space-y-3 text-[var(--color-text-primary)]"
          style={{ fontSize: 'var(--step-body)' }}
        >
          {RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </PageHero>

      <section className={`${GUTTER} py-32 md:py-40`}>
        <SectionHeading>Type</SectionHeading>
        <dl className="mt-16 space-y-14">
          {TYPE_STEPS.map(({ token, use, sample }) => (
            <div
              key={token}
              data-reveal
              className="flex flex-col-reverse gap-4 md:grid md:grid-cols-12"
            >
              <dt className="md:col-span-3" style={{ fontSize: 'var(--step-small)' }}>
                <code className="text-[var(--color-text-primary)]">{token}</code>
                <span className="mt-1 block text-[var(--color-text-secondary)]">{use}</span>
              </dt>
              <dd
                className="leading-[1.02] font-semibold tracking-[-0.035em] text-[var(--color-text-primary)] md:col-span-9"
                style={{ fontSize: `var(${token})` }}
              >
                {sample}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={`${GUTTER} bg-[var(--color-bg-secondary)] py-32 md:py-40`}>
        <SectionHeading>Colour</SectionHeading>
        <ul className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {COLOURS.map(({ token, use }) => (
            <li key={token} data-reveal>
              <div className="aspect-[4/3] rounded-2xl" style={{ background: `var(${token})` }} />
              <code className="mt-4 block text-[15px] text-[var(--color-text-primary)]">
                {token}
              </code>
              <p className="mt-1 text-[15px] text-[var(--color-text-secondary)]">{use}</p>
            </li>
          ))}
        </ul>
        <Body className="mt-12">
          Switch the theme in the footer to see the dark values. The ground and ink swap; nothing
          else changes.
        </Body>
      </section>

      <section className={`${GUTTER} grid gap-12 py-32 md:grid-cols-12 md:py-40`}>
        <div className="md:col-span-5">
          <SectionHeading>Actions</SectionHeading>
          <Body className="mt-8">
            One filled pill per screen. A second action is an underlined link, never a second
            button.
          </Body>
        </div>
        <div data-reveal className="flex flex-wrap items-center gap-6 md:col-span-7">
          <a
            href="#"
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--color-btn-primary-bg)] px-7 text-[17px] font-semibold text-[var(--color-btn-primary-text)] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
          >
            Download free for Mac
            <ArrowRight className="size-4" />
          </a>
          <a
            href="#"
            className="text-[17px] font-medium text-[var(--color-text-primary)] underline underline-offset-4 transition-opacity hover:opacity-70"
          >
            Source on GitHub
          </a>
          <div className="w-full rounded-2xl bg-[var(--color-text-primary)] p-8">
            <a
              href="#"
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--color-bg)] px-7 text-[17px] font-semibold text-[var(--color-text-primary)]"
            >
              On the inverted close
              <ArrowRight className="size-4" />
            </a>
          </div>
        </div>
      </section>

      <section
        className={`${GUTTER} grid gap-12 bg-[var(--color-bg-secondary)] py-32 md:grid-cols-12 md:py-40`}
      >
        <div className="md:col-span-5">
          <SectionHeading>Pictures</SectionHeading>
          <div className="mt-8 space-y-6">
            <ItemTitle>The approval card</ItemTitle>
            <Body>
              Rebuilt in HTML at true size and marked <code>data-ui</code>, so it keeps the
              app&apos;s own divider. Used in the hero, the try-it section and the use-case
              previews.
            </Body>
            <ItemTitle>App screenshots</ItemTitle>
            <Body>
              Taken from the real app demo views into <code>public/previews/</code>, always shown on
              the Mac wallpaper.
            </Body>
          </div>
        </div>
        <div data-reveal className="space-y-8 md:col-span-7">
          <ApprovalCard plan={SAMPLE_PLAN} />
          <AppScreenshot src="/previews/sort.jpg" alt="Talyx: the sort preview" />
        </div>
      </section>
    </>
  )
}
