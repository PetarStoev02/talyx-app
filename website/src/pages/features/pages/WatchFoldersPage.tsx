import { Eye, FolderPlus, Settings, Zap, Clock, Bell, RefreshCw } from 'lucide-react'
import { FeaturePageLayout } from '../../../shared/layouts/FeaturePageLayout'
import { WatchFoldersAnim } from '../../../shared/ui/HeroAnimations'

export function WatchFoldersPage() {
  return (
    <FeaturePageLayout
      slug="watch-folders"
      title="Watch Folders"
      subtitle="Set up automatic monitoring on any folder. New files are classified and sorted the moment they appear — hands-free organization."
      icon={Eye}
      heroIllustration={<WatchFoldersAnim />}
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
              icon: FolderPlus,
              title: 'Choose a folder to watch',
              description:
                'Pick any folder — your Downloads, Desktop, or project directory. Talyx begins monitoring it for new files.'
            },
            {
              step: '2',
              icon: Settings,
              title: 'Configure your preferences',
              description:
                'Choose between copy or move mode and define where sorted files should go.'
            },
            {
              step: '3',
              icon: Zap,
              title: 'Files are sorted automatically',
              description:
                'When new files appear in the watched folder, they are classified and organized instantly — no manual intervention needed.'
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
              icon: Clock,
              title: 'Real-time monitoring',
              description:
                'Files are detected and sorted within seconds of appearing in the folder.'
            },
            {
              icon: Bell,
              title: 'Set and forget',
              description:
                'Configure once and your folders stay organized without any ongoing effort.'
            },
            {
              icon: RefreshCw,
              title: 'Persistent across restarts',
              description:
                'Watch configurations are saved and resume automatically when you open Talyx.'
            },
            {
              icon: Settings,
              title: 'Flexible modes',
              description:
                'Choose to copy or move files, and set custom output directories per watched folder.'
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
