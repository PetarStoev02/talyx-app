import { ShieldCheck, Brain, KeyRound, Lock } from 'lucide-react'
import { REPO_URL } from '../../../shared/data/release'

const points = [
  {
    icon: Brain,
    title: 'Smart Local by default',
    desc: 'Out of the box, files are classified by name, extension and embedded metadata such as EXIF — never the document text — and nothing is sent anywhere. Turn on Your Claude in Settings and only the files that need reading are sent to your own Claude account, truncated, with currency amounts, dates and company names ending in a legal suffix masked first, best-effort.'
  },
  {
    icon: KeyRound,
    title: 'Your Claude, your account',
    desc: 'Connect the Claude you already pay for — an API key, or the Claude Code already signed in on your Mac. Talyx hosts no model and resells nothing. What leaves is only what the ability needs: the conversation for the assistant, a truncated, partly masked excerpt for sorting, a screenshot only when you ask it to look.'
  },
  {
    icon: Lock,
    title: 'Zero telemetry',
    desc: 'No usage tracking, no analytics, no crash reports. All settings, history, and file data stay in a local SQLite database on your machine. Your workflow is your business.'
  }
]

export function PrivacySection() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-[1100px]">
        <div className="flex flex-col items-center text-center">
          <div className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-[var(--color-icon-bg)] text-[var(--color-text-primary)]">
            <ShieldCheck className="size-7" />
          </div>
          <h2 className="text-[24px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)] sm:text-[36px]">
            Privacy by design.
          </h2>
          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
            Sorting defaults to Smart Local: no model, no download, nothing leaves your Mac. Your
            Claude is opt-in, from Settings. Apart from Your Claude and the assistant, the only
            network use is the update check to GitHub and the one-time voice model download from
            Hugging Face. There is no Talyx server.
          </p>
          <a
            href={REPO_URL}
            className="mt-4 text-sm font-medium text-[var(--color-text-primary)] underline underline-offset-4"
          >
            Don&apos;t trust us — read the code
          </a>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {points.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 text-center sm:p-8"
            >
              <div className="mx-auto mb-4 flex size-10 items-center justify-center rounded-xl bg-[var(--color-icon-bg)] text-[var(--color-text-primary)]">
                <Icon className="size-5" />
              </div>
              <h3 className="mb-2 text-base font-semibold text-[var(--color-text-primary)]">
                {title}
              </h3>
              <p className="text-sm leading-relaxed text-[var(--color-text-tertiary)]">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
