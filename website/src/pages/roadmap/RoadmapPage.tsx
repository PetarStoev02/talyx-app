import { Check, Clock, Sparkles } from 'lucide-react'
import { ISSUES_URL } from '../../shared/data/release'

interface RoadmapItem {
  title: string
  description: string
  status: 'done' | 'in-progress' | 'planned'
}

const completed: RoadmapItem[] = [
  {
    title: 'Open Source',
    description: 'Free under the MIT licence, with the source on GitHub (0.11).',
    status: 'done'
  },
  {
    title: 'AI Classification',
    description:
      'Smart Local from names and metadata, or the whole batch through your own Claude. Talyx hosts no classification models.',
    status: 'done'
  },
  {
    title: 'Bring Your Own Brain',
    description:
      'Talyx is the harness — abilities, approval, memory, notices. The model is yours: an API key or your Claude Code sign-in. Talyx-owned sorting models were retired.',
    status: 'done'
  },
  {
    title: 'Privacy-First Design',
    description:
      'File classification defaults to running 100% on your device, with no telemetry. Your Claude, an opt-in mode added later, is the one sorting option that sends file content to Anthropic.',
    status: 'done'
  },
  {
    title: 'Smart File Renaming',
    description:
      'AI-powered rename suggestions based on document content — dates, names, organizations, and topics.',
    status: 'done'
  },
  {
    title: 'Watch Folders',
    description:
      'Automatic sorting when new files appear. Set it once, files get organized while you work.',
    status: 'done'
  },
  {
    title: 'Multilingual Support',
    description:
      'Classification and renaming follow the language of the document — English gets English names, Bulgarian gets Cyrillic.',
    status: 'done'
  },
  {
    title: 'Keyboard Shortcuts',
    description: 'Navigate and sort with keyboard shortcuts for a faster workflow.',
    status: 'done'
  },
  {
    title: 'Duplicate Detection',
    description: 'Detect and handle duplicate files before sorting.',
    status: 'done'
  },
  {
    title: 'Scheduled Sorts',
    description:
      'Automatic sorting on a schedule — daily, weekly, or monthly. Runs in the background.',
    status: 'done'
  },
  {
    title: 'Search',
    description:
      'Search what Talyx has indexed — files you sorted and folders you Deep Scan. A rule-based parser turns a plain-language query into keywords and a file type; no model is involved.',
    status: 'done'
  },
  {
    title: 'MCP Server Architecture',
    description:
      'Talyx exposes an MCP server so external AI assistants (Claude Desktop, Cursor) can trigger file operations via JSON-RPC.',
    status: 'done'
  },
  {
    title: 'The Assistant',
    description:
      'Cmd+Shift+Space opens an overlay anywhere. Your own Claude plans the steps, shows a card, and asks before it changes anything. Kill switch on Cmd+Shift+Esc. Replaced the Quick Search overlay.',
    status: 'done'
  },
  {
    title: 'Bring Your Own Claude',
    description:
      'Run the assistant on an Anthropic API key or on the Claude Code already signed in on your Mac. Pick the model from inside the input.',
    status: 'done'
  },
  {
    title: 'Voice',
    description:
      'Hold Option+Space to dictate; replies spoken back by a neural voice. Whisper and Kokoro run on-device — audio never leaves the Mac. Apple Silicon required.',
    status: 'done'
  },
  {
    title: 'Everyday Abilities',
    description:
      'Calendar, reminders, notes, unread mail, Music, dark mode, Wi‑Fi, volume, image conversion, recent files, disk clutter — plus repos, shell commands, apps and URLs for developers.',
    status: 'done'
  },
  {
    title: 'First Run',
    description:
      'Welcome, connect your Claude (optional), done. No hardware detection, no model download.',
    status: 'done'
  },
  {
    title: 'Language-Aware Renaming',
    description:
      'AI detects content language and suggests filenames in the same language. Bulgarian documents get Cyrillic names, English reports get English names.',
    status: 'done'
  },
  {
    title: 'Capture',
    description:
      'Dump a thought into the overlay and it lands as a Note, Reminder, Calendar event or file — without typing a prompt.',
    status: 'done'
  },
  {
    title: 'Recall',
    description: 'One search returns indexed files and past assistant conversations together.',
    status: 'done'
  },
  {
    title: 'Triage and Watch',
    description:
      'Ask what needs you now and get a ranked pile. Notices are rare, ranked, and one ⌘⇧Esc quiets them for the day.',
    status: 'done'
  },
  {
    title: 'Act — Screen Control',
    description:
      'When no typed ability fits, the assistant looks at the screen and clicks, types, presses keys or scrolls — every step carded, kill switch mid-way.',
    status: 'done'
  },
  {
    title: 'Focus',
    description:
      'Meeting mode in one action: notices go quiet until the meeting ends, and the related files and chats come with it.',
    status: 'done'
  }
]

const inProgress: RoadmapItem[] = [
  {
    title: 'Screen Control Acceptance',
    description:
      'Act ships for the display under the cursor on Apple Silicon and Intel. Wider hardware and multi-display acceptance is underway.',
    status: 'in-progress' as const
  }
]

const planned: RoadmapItem[] = [
  {
    title: 'More Brains',
    description:
      'Run the assistant on other coding agents you already pay for, starting with Codex. Same abilities, same approval gate.',
    status: 'planned' as const
  },
  {
    title: 'Earned Autonomy',
    description:
      'Every ability starts by asking. As one proves itself, you can move it to automatic — the assistant gets quieter the longer you use it.',
    status: 'planned' as const
  },
  {
    title: 'Undo for Every Ability',
    description:
      'Reminders, notes and system toggles become reversible the same way file moves already are.',
    status: 'planned' as const
  },
  {
    title: 'Abilities over MCP',
    description:
      'Expose the same abilities through the built-in MCP server so Claude Desktop, Cursor and other clients can drive your Mac with the same approval gate.',
    status: 'planned' as const
  },
  {
    title: 'Multi-Device',
    description:
      'One Mac is the boss, others are helpers over your own network. Your phone is a remote for the assistant, not a place files go.',
    status: 'planned' as const
  }
]

function StatusBadge({ status }: { status: RoadmapItem['status'] }) {
  if (status === 'done')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-500">
        <Check className="size-3" /> Done
      </span>
    )
  if (status === 'in-progress')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-500">
        <Clock className="size-3" /> In Progress
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-400">
      <Sparkles className="size-3" /> Planned
    </span>
  )
}

function Section({ title, items }: { title: string; items: RoadmapItem[] }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.title}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                {item.title}
              </h3>
              <StatusBadge status={item.status} />
            </div>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function RoadmapPage() {
  return (
    <div>
      <section className="px-4 pt-16 pb-12 text-center sm:px-6 sm:pt-24 sm:pb-16">
        <div className="mx-auto max-w-[700px]">
          <h1 className="text-[40px] font-bold leading-[1.1] tracking-[-0.03em] text-[var(--color-text-primary)] sm:text-[56px]">
            Roadmap
          </h1>
          <p className="mt-5 text-[17px] leading-relaxed text-[var(--color-text-secondary)] sm:text-xl">
            What we've built, what we're working on, and where we're headed. Your feedback shapes
            our priorities.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[900px] space-y-12 px-4 pb-20 sm:px-6 sm:pb-28">
        <Section title="Completed" items={completed} />
        <Section title="In Progress" items={inProgress} />
        <Section title="Planned" items={planned} />

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Have a feature request?{' '}
            <a
              href={ISSUES_URL}
              className="font-medium text-[var(--color-text-primary)] underline underline-offset-4"
            >
              Let us know
            </a>{' '}
            — your feedback directly influences what we build next.
          </p>
        </div>
      </section>
    </div>
  )
}
