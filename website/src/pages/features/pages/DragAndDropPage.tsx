import { GripVertical, FolderInput, Eye, Check, Zap, MousePointer, Layers } from 'lucide-react'
import { FeaturePageLayout } from '../../../shared/layouts/FeaturePageLayout'
import { DragDropAnim } from '../../../shared/ui/HeroAnimations'

export function DragAndDropPage() {
  return (
    <FeaturePageLayout
      slug="drag-and-drop"
      title="Drag & Drop Sorting"
      subtitle="Simply drag a folder into Talyx, preview how your files will be organized, and confirm with a single click."
      icon={GripVertical}
      heroIllustration={<DragDropAnim />}
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
              title: 'Drag your folder in',
              description:
                'Drag any folder from your file manager directly into the Talyx window. Or use the folder picker to browse.'
            },
            {
              step: '2',
              icon: Eye,
              title: 'Preview the classification',
              description:
                'See exactly how your files will be categorized before anything moves. Review and adjust as needed.'
            },
            {
              step: '3',
              icon: Check,
              title: 'Confirm and sort',
              description:
                'Hit sort and watch your files organize themselves. The entire process takes seconds, even for large folders.'
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
              icon: MousePointer,
              title: 'Intuitive interface',
              description:
                'Drag and drop feels natural. No menus to navigate or commands to remember.'
            },
            {
              icon: Eye,
              title: 'Preview before sorting',
              description:
                'Always see the proposed organization before confirming. Nothing happens without your approval.'
            },
            {
              icon: Zap,
              title: 'Lightning fast',
              description:
                'Classification and sorting complete in seconds, even for folders with thousands of files.'
            },
            {
              icon: Layers,
              title: 'Handles nested folders',
              description:
                'Deep folder structures are flattened and re-organized into clean, logical categories.'
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
