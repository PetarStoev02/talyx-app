import type { LucideIcon } from 'lucide-react'
import { Brain, Eye, History, ShieldCheck, Sparkles } from 'lucide-react'
import { ABILITY_COUNT, EXTENSION_COUNT } from '../../../shared/data/offer'
import {
  AiClassificationAnim,
  SortHistoryAnim,
  WatchFoldersAnim
} from '../../../shared/ui/HeroAnimations'
import { AbilitiesAnim, ApprovalAnim, Zoom } from './FeatureAnims'

function FeatureCard({
  icon: Icon,
  title,
  description,
  wide = false,
  children
}: {
  icon: LucideIcon
  title: string
  description: string
  wide?: boolean
  children?: React.ReactNode
}) {
  return (
    <div
      className={`flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 sm:p-8 ${
        wide ? 'md:col-span-2' : 'md:col-span-1'
      }`}
    >
      <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-[var(--color-icon-bg)] text-[var(--color-text-primary)]">
        <Icon className="size-5" />
      </div>
      <h3 className="mb-2 text-lg font-semibold text-[var(--color-text-primary)]">{title}</h3>
      <p className="text-sm leading-relaxed text-[var(--color-text-tertiary)]">{description}</p>
      {children ? <div className="mt-5 flex-1">{children}</div> : null}
    </div>
  )
}

/**
 * Symmetric 2+1 / 1+1+1 grid. Line illustrations rather than app screenshots:
 * they read at card size, stay crisp, and never go stale when the UI moves.
 */
export function FeaturesSection() {
  return (
    <section id="features" className="px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-[1100px]">
        <h2 className="mb-8 text-center text-[24px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)] sm:mb-12 sm:text-[32px]">
          What you get
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FeatureCard
            wide
            icon={Sparkles}
            title={`${ABILITY_COUNT} things it can do`}
            description="Capture a thought, recall a file or a past chat, ask what needs you now, quiet Talyx for a meeting. Each one is a typed ability with a fixed shape — no free-run shell."
          >
            <AbilitiesAnim />
          </FeatureCard>

          <FeatureCard
            icon={ShieldCheck}
            title="0 assistant changes unapproved"
            description="Anything the assistant changes — files, your system or the screen — shows a card first, naming the exact change. Reads run without asking. When no ability fits, Talyx looks at the screen and clicks — every click and keystroke carded, ⌘⇧Esc stops it."
          >
            <Zoom scale={1.7}>
              <ApprovalAnim />
            </Zoom>
          </FeatureCard>

          <FeatureCard
            icon={Brain}
            title={`${EXTENSION_COUNT} file types, 0 setup`}
            description="Smart Local sorting works on first launch from name and metadata alone. Turn on Your Claude in Settings when you want content read too."
          >
            <Zoom scale={1.2}>
              <AiClassificationAnim />
            </Zoom>
          </FeatureCard>

          <FeatureCard
            icon={History}
            title="1 click to undo any batch"
            description="Every sort is recorded. Restore a single file or a whole batch to exactly where it came from."
          >
            <Zoom scale={1.4}>
              <SortHistoryAnim />
            </Zoom>
          </FeatureCard>

          <FeatureCard
            icon={Eye}
            title="Watch folders, rare notices"
            description="Point Talyx at Downloads. New files are sorted on their own as they land, and every batch can be undone. Notices are ranked and rare, and one ⌘⇧Esc quiets them for the day."
          >
            <Zoom scale={2.2}>
              <WatchFoldersAnim />
            </Zoom>
          </FeatureCard>
        </div>
      </div>
    </section>
  )
}
