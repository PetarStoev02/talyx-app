import { Brain, FolderInput, Sparkles, Layers, FileSearch, Zap, Settings, Cpu } from 'lucide-react'
import { FeaturePageLayout } from '../../../shared/layouts/FeaturePageLayout'
import { AiClassificationAnim } from '../../../shared/ui/HeroAnimations'

export function AiClassificationPage() {
  return (
    <FeaturePageLayout
      slug="ai-classification"
      title="AI Classification"
      subtitle="Smart Local sorts by name and metadata on your Mac — nothing sent. Connect Your Claude and the whole batch can be classified with the same account as the assistant. Talyx is the harness; you bring the brain. No Talyx-hosted classification downloads."
      icon={Brain}
      heroIllustration={<AiClassificationAnim />}
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
              icon: FolderInput,
              title: 'Talyx scans your files',
              description:
                'Select or drag any folder into Talyx. It scans every file for its extension and metadata. Smart Local classifies from those alone; Your Claude also gets extracted text from readable files.'
            },
            {
              step: '2',
              icon: Sparkles,
              title: 'Your Claude reads the whole batch',
              description:
                'When Your Claude is on and reachable, the whole preview batch goes to your own account in one look — names, metadata, and for readable files a 2,000-character excerpt with currency amounts, dates and company names ending in a legal suffix masked, best-effort. If Claude is unreachable, Smart Local answers and the Sort page says so.'
            },
            {
              step: '3',
              icon: Layers,
              title: 'Preview and sort with one click',
              description:
                'Review the proposed organization before applying. Choose to copy or move files, then sort with one click. A whole sort batch can be undone.'
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
              icon: FileSearch,
              title: 'Semantic understanding',
              description:
                'AI reads content, not just extensions. Invoices, contracts, reports, and photos are classified by what they actually contain.'
            },
            {
              icon: Settings,
              title: 'One batch, one look',
              description:
                'The whole preview is classified together, so “invoice”, “receipt” and “statement” land in the same category instead of being guessed one file at a time.'
            },
            {
              icon: Zap,
              title: 'Your account, your quota',
              description:
                'An Anthropic API key, or the Claude Code already signed in on your Mac. Talyx hosts no model, resells nothing, and adds no subscription of its own.'
            },
            {
              icon: Cpu,
              title: 'Smart Local is the floor',
              description:
                'Turn Your Claude off, lose the network, or hit a rate limit, and sorting still works from names and metadata — no model, no download, nothing sent.'
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
