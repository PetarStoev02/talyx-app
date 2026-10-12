import { FileEdit, FileSearch, Sparkles, Check, Eye, FileText, Pencil } from 'lucide-react'
import { FeaturePageLayout } from '../../../shared/layouts/FeaturePageLayout'
import { SmartRenameAnim } from '../../../shared/ui/HeroAnimations'

export function SmartRenamePage() {
  return (
    <FeaturePageLayout
      slug="smart-rename"
      title="Smart Rename"
      subtitle="When you turn on Your Claude sorting, it reads your file content and suggests intelligent, descriptive filenames following Harvard file naming conventions. Without it, Smart Local only tidies generic file names like IMG_4032.jpg or Document (3).pdf; names based on what a file contains come from Your Claude."
      icon={FileEdit}
      heroIllustration={<SmartRenameAnim />}
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
              icon: FileSearch,
              title: 'AI reads your file content',
              description:
                'Talyx extracts text and metadata from your files, then analyzes them with your own Claude, the same account the assistant uses.'
            },
            {
              step: '2',
              icon: Sparkles,
              title: 'Generates a Harvard-convention name',
              description:
                'Based on the analysis, AI suggests a clean, descriptive filename following Harvard file naming conventions — lowercase, hyphen-separated, with dates and descriptors that make files easy to find and sort.'
            },
            {
              step: '3',
              icon: Check,
              title: 'Preview and apply',
              description:
                'Review the suggested names before applying. Accept individual renames or apply them all at once.'
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
              icon: Eye,
              title: 'Always preview first',
              description:
                'See every proposed rename before it happens. Nothing is renamed until you confirm the sort.'
            },
            {
              icon: FileText,
              title: 'Content-aware Harvard naming',
              description:
                'With Your Claude, names are based on what the file actually contains, following Harvard file naming conventions for clean, consistent, searchable filenames. Smart Local only tidies generic names.'
            },
            {
              icon: Pencil,
              title: 'Edit suggestions',
              description: 'Tweak any AI-suggested name before applying. You stay in full control.'
            },
            {
              icon: Sparkles,
              title: 'Batch processing',
              description:
                'Rename hundreds of files at once while keeping names consistent and meaningful.'
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
