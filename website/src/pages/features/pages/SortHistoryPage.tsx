import { History, FileText, FolderSearch, RotateCcw, Shield, Database, Clock } from 'lucide-react'
import { FeaturePageLayout } from '../../../shared/layouts/FeaturePageLayout'
import { SortHistoryAnim } from '../../../shared/ui/HeroAnimations'

export function SortHistoryPage() {
  return (
    <FeaturePageLayout
      slug="sort-history"
      title="Sort History"
      subtitle="Every sort is recorded as a batch. Browse past batches, see exactly where each file went, and undo a whole batch."
      icon={History}
      heroIllustration={<SortHistoryAnim />}
    >
      {/* How It Works */}
      <div className="mb-16">
        <h2 className="mb-8 text-[20px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)] sm:text-[24px]">
          How It Works
        </h2>
        <div className="space-y-6">
          {[
            {
              step: '1',
              icon: FileText,
              title: 'Every move and copy is logged',
              description:
                'Each file move or copy is recorded with a timestamp, its source and destination paths, and the category it was sorted into.'
            },
            {
              step: '2',
              icon: FolderSearch,
              title: 'Browse past sorts',
              description:
                'Pick any batch from the history list to see its mode, time, and every file with where it came from and where it went.'
            },
            {
              step: '3',
              icon: RotateCcw,
              title: 'Undo a whole batch',
              description:
                "Undo a whole batch: moved files go back where they came from, copies are removed. Anything Talyx can't restore safely — a file that's gone, or a new file in its old place — is left as it is and listed for you. The batch stays in the list, marked undone."
            }
          ].map((item) => (
            <div key={item.step} className="flex gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-icon-bg)] text-[var(--color-text-primary)]">
                <item.icon className="size-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {item.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-tertiary)]">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Key Benefits */}
      <div>
        <h2 className="mb-8 text-[20px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)] sm:text-[24px]">
          Key Benefits
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              icon: Shield,
              title: 'Never lose files',
              description:
                "Nothing is overwritten on the way back. If Talyx can't restore a file safely, it leaves it where it is and tells you."
            },
            {
              icon: Database,
              title: 'Persistent history',
              description: 'History is stored in a local database and persists across app restarts.'
            },
            {
              icon: Clock,
              title: 'Timestamped entries',
              description:
                'See exactly when each operation happened. Track your organization progress over time.'
            },
            {
              icon: RotateCcw,
              title: 'Batch undo',
              description:
                "Undo an entire sort session in one step. Moved files return to their original locations; copies are removed; anything that can't be restored safely is left and reported."
            }
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 transition-colors hover:bg-[var(--color-surface-hover)]"
            >
              <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-[var(--color-icon-bg)] text-[var(--color-text-primary)]">
                <item.icon className="size-5" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                {item.title}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-tertiary)]">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </FeaturePageLayout>
  )
}
