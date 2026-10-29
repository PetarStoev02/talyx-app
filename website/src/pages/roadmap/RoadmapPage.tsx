import { ISSUES_URL } from '../../shared/data/release'
import {
  AppScreenshot,
  Body,
  GUTTER,
  ItemTitle,
  PageHero,
  SectionHeading,
  STEP,
  stagger
} from '../../shared/ui/page'
import { DownloadSection } from '../../widgets/download/DownloadSection'

interface RoadmapItem {
  title: string
  description: string
}

const completed: RoadmapItem[] = [
  {
    title: 'Open source',
    description: 'Free under the MIT licence, with the source on GitHub (0.11).'
  },
  {
    title: 'AI classification',
    description:
      'Smart Local from names and metadata, or the whole batch through your own Claude. Talyx hosts no classification models.'
  },
  {
    title: 'Bring your own brain',
    description:
      'Talyx is the harness — abilities, approval, memory, notices. The model is yours: an API key or your Claude Code sign-in. Talyx-owned sorting models were retired.'
  },
  {
    title: 'Privacy-first design',
    description:
      'File classification defaults to running 100% on your device, with no telemetry. Your Claude, an opt-in mode added later, is the one sorting option that sends file content to Anthropic.'
  },
  {
    title: 'Smart file renaming',
    description:
      'AI-powered rename suggestions based on document content — dates, names, organizations, and topics.'
  },
  {
    title: 'Watch folders',
    description:
      'Automatic sorting when new files appear. Set it once, files get organized while you work.'
  },
  {
    title: 'Multilingual support',
    description:
      'Classification and renaming follow the language of the document — English gets English names, Bulgarian gets Cyrillic.'
  },
  {
    title: 'Keyboard shortcuts',
    description: 'Navigate and sort with keyboard shortcuts for a faster workflow.'
  },
  {
    title: 'Duplicate detection',
    description: 'Detect and handle duplicate files before sorting.'
  },
  {
    title: 'Scheduled sorts',
    description:
      'Automatic sorting on a schedule — daily, weekly, or monthly. Runs in the background.'
  },
  {
    title: 'Search',
    description:
      'Search what Talyx has indexed — files you sorted and folders you Deep Scan. A rule-based parser turns a plain-language query into keywords and a file type; no model is involved.'
  },
  {
    title: 'MCP server architecture',
    description:
      'Talyx exposes an MCP server so external AI assistants (Claude Desktop, Cursor) can trigger file operations via JSON-RPC.'
  },
  {
    title: 'The assistant',
    description:
      'Cmd+Shift+Space opens an overlay anywhere. Your own Claude plans the steps, shows a card, and asks before it changes anything. Kill switch on Cmd+Shift+Esc. Replaced the Quick Search overlay.'
  },
  {
    title: 'Bring your own Claude',
    description:
      'Run the assistant on an Anthropic API key or on the Claude Code already signed in on your Mac. Pick the model from inside the input.'
  },
  {
    title: 'Voice',
    description:
      'Hold Option+Space to dictate; replies spoken back by a neural voice. Whisper and Kokoro run on-device — audio never leaves the Mac. Apple Silicon required.'
  },
  {
    title: 'Everyday abilities',
    description:
      'Calendar, reminders, notes, unread mail, Music, dark mode, Wi‑Fi, volume, image conversion, recent files, disk clutter — plus repos, shell commands, apps and URLs for developers.'
  },
  {
    title: 'First run',
    description:
      'Welcome, connect your Claude (optional), done. No hardware detection, no model download.'
  },
  {
    title: 'Language-aware renaming',
    description:
      'AI detects content language and suggests filenames in the same language. Bulgarian documents get Cyrillic names, English reports get English names.'
  },
  {
    title: 'Capture',
    description:
      'Dump a thought into the overlay and it lands as a Note, Reminder, Calendar event or file — without typing a prompt.'
  },
  {
    title: 'Recall',
    description: 'One search returns indexed files and past assistant conversations together.'
  },
  {
    title: 'Triage and watch',
    description:
      'Ask what needs you now and get a ranked pile. Notices are rare, ranked, and one ⌘⇧Esc quiets them for the day.'
  },
  {
    title: 'Act: screen control',
    description:
      'When no typed ability fits, the assistant looks at the screen and clicks, types, presses keys or scrolls — every step carded, kill switch mid-way.'
  },
  {
    title: 'Focus',
    description:
      'Meeting mode in one action: notices go quiet until the meeting ends, and the related files and chats come with it.'
  }
]

const inProgress: RoadmapItem[] = [
  {
    title: 'Screen control acceptance',
    description:
      'Act ships for the display under the cursor on Apple Silicon and Intel. Wider hardware and multi-display acceptance is underway.'
  }
]

const planned: RoadmapItem[] = [
  {
    title: 'More brains',
    description:
      'Run the assistant on other coding agents you already pay for, starting with Codex. Same abilities, same approval gate.'
  },
  {
    title: 'Earned autonomy',
    description:
      'Every ability starts by asking. As one proves itself, you can move it to automatic — the assistant gets quieter the longer you use it.'
  },
  {
    title: 'Undo for every ability',
    description:
      'Reminders, notes and system toggles become reversible the same way file moves already are.'
  },
  {
    title: 'Abilities over MCP',
    description:
      'Expose the same abilities through the built-in MCP server so Claude Desktop, Cursor and other clients can drive your Mac with the same approval gate.'
  },
  {
    title: 'Multi-device',
    description:
      'One Mac is the boss, others are helpers over your own network. Your phone is a remote for the assistant, not a place files go.'
  }
]

const SHIPPED_SCREENS = [
  { src: '/previews/suggestions.jpg', alt: 'The assistant in Talyx' },
  { src: '/previews/watch.jpg', alt: 'Watch folders in Talyx' },
  { src: '/previews/history.jpg', alt: 'Sort history and undo in Talyx' }
]

/** A status as a heading on the left and its items, unboxed, on the right. */
function StatusSection({
  title,
  lead,
  items,
  children
}: {
  title: string
  lead: string
  items: RoadmapItem[]
  children?: React.ReactNode
}) {
  return (
    <section className={`${GUTTER} grid gap-12 py-16 md:grid-cols-12 md:py-24`}>
      <div className="md:col-span-4">
        <SectionHeading>{title}</SectionHeading>
        <Body className="mt-6">{lead}</Body>
      </div>
      <ul className="grid gap-x-10 gap-y-12 sm:grid-cols-2 md:col-span-8">
        {items.map((item, i) => (
          <li key={item.title} data-reveal style={stagger(i % 4)}>
            <ItemTitle>{item.title}</ItemTitle>
            <Body className="mt-3">{item.description}</Body>
          </li>
        ))}
      </ul>
      {children ? <div className="md:col-span-12">{children}</div> : null}
    </section>
  )
}

export function RoadmapPage() {
  return (
    <>
      <PageHero
        title="Roadmap"
        lead="What we've built, what we're working on, and where we're headed. Your feedback shapes our priorities."
      >
        <AppScreenshot src="/previews/sort.jpg" alt="The Sort page in Talyx" />
      </PageHero>

      <StatusSection title="In progress" lead="Being built and tested now." items={inProgress} />
      <StatusSection title="Planned" lead="Where Talyx is headed next." items={planned} />
      <StatusSection
        title="Shipped"
        lead="Everything here is in the app you can download today."
        items={completed}
      >
        <ul className="mt-12 grid gap-10 md:grid-cols-3">
          {SHIPPED_SCREENS.map(({ src, alt }, i) => (
            <li key={src} data-reveal style={stagger(i)}>
              <AppScreenshot src={src} alt={alt} />
            </li>
          ))}
        </ul>
      </StatusSection>

      <section className={`${GUTTER} grid gap-12 py-16 md:grid-cols-12 md:py-24`}>
        <div className="md:col-span-4">
          <SectionHeading>Ask for it</SectionHeading>
        </div>
        <p
          data-reveal
          className="max-w-[40ch] leading-snug text-[var(--color-text-primary)] md:col-span-8"
          style={STEP.lead}
        >
          Have a feature request?{' '}
          <a
            href={ISSUES_URL}
            className="font-semibold underline underline-offset-4 transition-opacity hover:opacity-70"
          >
            Let us know on GitHub
          </a>
          . Your feedback directly influences what we build next.
        </p>
      </section>

      <DownloadSection />
    </>
  )
}
