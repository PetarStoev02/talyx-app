import {
  Sparkles,
  Command,
  MessageSquare,
  ShieldCheck,
  Mic,
  Calendar,
  FolderOpen,
  Terminal,
  Undo2,
  KeyRound
} from 'lucide-react'
import { FeaturePageLayout } from '../../../shared/layouts/FeaturePageLayout'
import { QuickSearchAnim } from '../../../shared/ui/HeroAnimations'

export function AssistantPage() {
  return (
    <FeaturePageLayout
      slug="assistant"
      title="The Assistant"
      subtitle="Press Cmd+Shift+Space anywhere and tell your Mac what to do. Your own Claude — an Anthropic API key or the Claude Code you already have — plans the steps, shows you a card, and asks before it changes anything."
      icon={Sparkles}
      heroIllustration={<QuickSearchAnim />}
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
              icon: Command,
              title: 'Press Cmd+Shift+Space',
              description:
                'A system-wide shortcut opens the assistant overlay on top of whatever you are doing. Type, or hold Option+Space and speak.'
            },
            {
              step: '2',
              icon: MessageSquare,
              title: 'Say it in your own words',
              description:
                '"Sort my Downloads", "what is on my calendar today", "run the tests in talyx", "remind me to call the bank at 4". The assistant picks the right ability and fills in the details.'
            },
            {
              step: '3',
              icon: ShieldCheck,
              title: 'Read the card, then approve',
              description:
                'Anything that changes files or your system shows exactly what will happen before it runs. Approve, deny, or hit Cmd+Shift+Esc to stop everything. Reads never ask.'
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

      {/* What it can do */}
      <div>
        <h2 className="mb-8 text-[20px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)] sm:text-[24px]">
          What It Can Do
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              icon: KeyRound,
              title: 'Bring your own Claude',
              description:
                'Paste an Anthropic API key, or point Talyx at the Claude Code already signed in on your Mac and run on your subscription. Pick the model per conversation.'
            },
            {
              icon: Mic,
              title: 'Voice in, voice out',
              description:
                'Hold Option+Space to dictate. Replies can be spoken back in a natural neural voice. Speech recognition and synthesis run on your Mac — audio never leaves it. Apple Silicon required.'
            },
            {
              icon: FolderOpen,
              title: 'Files',
              description:
                'Sort a folder by content, find duplicates, search inside documents, find a file by name, open recent work, convert images, see what is cluttering your disk.'
            },
            {
              icon: Calendar,
              title: 'Your day',
              description:
                'What is on your calendar today or tomorrow, add a reminder, save a note, check unread mail, control Music, toggle dark mode, Wi-Fi or volume.'
            },
            {
              icon: Terminal,
              title: 'Your code',
              description:
                'List the repositories in your projects folder, run a command in one of them, open an app or a URL. Every command is shown before it runs.'
            },
            {
              icon: Undo2,
              title: 'Undo and a kill switch',
              description:
                'Every change is logged and "undo that" takes back the last one. Cmd+Shift+Esc stops the assistant and any running command instantly.'
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
