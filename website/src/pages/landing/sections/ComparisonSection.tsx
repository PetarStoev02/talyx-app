import { Check, X, Minus } from 'lucide-react'

interface Row {
  feature: string
  talyx: 'yes' | 'no' | 'partial' | string
  nothing: 'yes' | 'no' | 'partial' | string
  sparkle: 'yes' | 'no' | 'partial' | string
  hazel: 'yes' | 'no' | 'partial' | string
}

const rows: Row[] = [
  {
    feature: 'Assistant for calendar, mail, music, code',
    talyx: 'yes',
    nothing: 'no',
    sparkle: 'no',
    hazel: 'no'
  },
  {
    feature: 'Voice in and out, on-device',
    talyx: 'yes',
    nothing: 'no',
    sparkle: 'no',
    hazel: 'no'
  },
  {
    feature: 'Operates the screen when no ability fits',
    talyx: 'yes',
    nothing: 'no',
    sparkle: 'no',
    hazel: 'no'
  },
  {
    feature: 'Meeting mode: quiet, plus the related files',
    talyx: 'yes',
    nothing: 'no',
    sparkle: 'no',
    hazel: 'no'
  },
  {
    feature: 'Sorts by what is inside the file',
    talyx: 'yes',
    nothing: 'no',
    sparkle: 'yes',
    hazel: 'no'
  },
  { feature: 'Works with no API key', talyx: 'yes', nothing: 'yes', sparkle: 'no', hazel: 'yes' },
  { feature: 'Watch folders', talyx: 'yes', nothing: 'no', sparkle: 'no', hazel: 'yes' },
  {
    feature: 'One-click undo of a whole batch',
    talyx: 'yes',
    nothing: 'no',
    sparkle: 'no',
    hazel: 'no'
  },
  {
    feature: 'Smart rename (Harvard conventions)',
    talyx: 'yes',
    nothing: 'no',
    sparkle: 'partial',
    hazel: 'partial'
  },
  { feature: 'Runs offline by default', talyx: 'yes', nothing: 'yes', sparkle: 'no', hazel: 'yes' },
  {
    feature: 'Your Downloads folder gets sorted',
    talyx: 'yes',
    nothing: 'no',
    sparkle: 'yes',
    hazel: 'yes'
  },
  { feature: 'Cost', talyx: 'Free', nothing: '$0', sparkle: '$179', hazel: '$42' }
]

function StatusIcon({ value }: { value: 'yes' | 'no' | 'partial' | string }) {
  if (value === 'yes') return <Check className="mx-auto size-4 text-[var(--color-text-primary)]" />
  if (value === 'no') return <X className="mx-auto size-4 text-[var(--color-text-tertiary)]" />
  if (value === 'partial')
    return <Minus className="mx-auto size-4 text-[var(--color-text-tertiary)]" />
  return <span className="text-sm">{value}</span>
}

export function ComparisonSection() {
  return (
    <section className="border-y border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-[860px]">
        <h2 className="mb-4 text-center text-[24px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)] sm:text-[32px]">
          Free, open source, and yours to read
        </h2>
        <p className="mb-10 text-center text-sm text-[var(--color-text-secondary)]">
          Including the one most people pick: doing nothing.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  Feature
                </th>
                <th className="pb-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--color-text-primary)]">
                  Talyx
                </th>
                <th className="pb-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  Doing nothing
                </th>
                <th className="pb-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  Sparkle
                </th>
                <th className="pb-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  Hazel
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ feature, talyx, nothing, sparkle, hazel }) => (
                <tr key={feature} className="border-b border-[var(--color-border)]">
                  <td className="py-3 pr-4 text-[var(--color-text-secondary)]">{feature}</td>
                  <td className="py-3 text-center">
                    <StatusIcon value={talyx} />
                  </td>
                  <td className="py-3 text-center">
                    <StatusIcon value={nothing} />
                  </td>
                  <td className="py-3 text-center">
                    <StatusIcon value={sparkle} />
                  </td>
                  <td className="py-3 text-center">
                    <StatusIcon value={hazel} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-8 text-center text-sm text-[var(--color-text-secondary)]">
          Doing nothing is free and the folder stays as it is. Talyx is free too, under the MIT
          licence, and every line of it is on GitHub.
        </p>
      </div>
    </section>
  )
}
