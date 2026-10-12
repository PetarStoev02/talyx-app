import { ShieldCheck, Brain, Cpu, Lock, HardDrive, Eye, Globe } from 'lucide-react'
import { FeaturePageLayout } from '../../../shared/layouts/FeaturePageLayout'
import { PrivacyOfflineAnim } from '../../../shared/ui/HeroAnimations'

export function PrivacyOfflinePage() {
  return (
    <FeaturePageLayout
      slug="privacy-offline"
      title="Your Data, Your Rules"
      subtitle="Sorting asks one question — who reads your files — and defaults to the private answer. Smart sorting classifies by name and metadata alone, with nothing sent anywhere. Turn on Your Claude and the whole batch may be sent to your own Claude account — names, metadata, and truncated contents when available, with currency amounts, dates and company names ending in a legal suffix masked first, best-effort. The optional assistant is separate and always uses your own Claude."
      icon={ShieldCheck}
      heroIllustration={<PrivacyOfflineAnim />}
    >
      {/* How It Works */}
      <div className="mb-16">
        <h2 className="mb-8 text-[20px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)] sm:text-[24px]">
          Who Reads Your Files
        </h2>
        <div className="space-y-6">
          {[
            {
              step: '1',
              icon: ShieldCheck,
              title: 'Smart Local (default) — nothing leaves your Mac',
              description:
                'Classifies by file name, extension, size, and metadata already on your device. No model, no download, no network call, ever.'
            },
            {
              step: '2',
              icon: Cpu,
              title: 'Your Claude (opt-in) — reads only what needs reading',
              description:
                'Sends only the files a reader could actually open — documents, spreadsheets, emails, plain text: file name, size, extension, and the first 2,000 characters of extracted text, with currency amounts, dates and company names ending in a legal suffix masked first, best-effort — to your own Anthropic account, through your API key or your Claude Code sign-in.'
            },
            {
              step: '3',
              icon: Brain,
              title: 'The assistant — your conversation, your account',
              description:
                'What you type in the overlay, and the results of the abilities it calls, go to your own Claude and nowhere else. Screen control sends a screenshot only when you ask it to look. Talyx runs no model of its own and never sees any of it.'
            },
            {
              step: '4',
              icon: Globe,
              title: 'Everything else that touches the network',
              description:
                'The update check asks GitHub for a newer version and opens its release page. Voice models download from Hugging Face the first time you use voice. In Smart Local, nothing else leaves your Mac. There is no Talyx server and no account.'
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
              icon: Lock,
              title: 'Private by default',
              description:
                'Smart Local (the default) never sends file content anywhere. Turn on Your Claude and only the files that need reading leave your machine, truncated and masked first (currency amounts, dates and company names ending in a legal suffix, best-effort).'
            },
            {
              icon: HardDrive,
              title: 'Settings stay local',
              description:
                'All settings, history, and configurations are stored locally in a SQLite database on your machine. We never store your files or documents.'
            },
            {
              icon: Eye,
              title: 'No telemetry',
              description:
                "We don't collect usage data, analytics, or crash reports. Your workflow is your business."
            },
            {
              icon: ShieldCheck,
              title: 'No account required to sort',
              description:
                'Smart Local needs no API key, no cloud subscription, no sign-up, and no download — install Talyx and start sorting. Your Claude is the one optional upgrade, from Settings.'
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
