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

/** What 1.0 ships, from docs/release-notes/1.0.0.md. */
const shipped: RoadmapItem[] = [
  {
    title: 'Roster',
    description:
      'Every bot in one list, with pins, folders, unread marks and what each bot is doing. Each bot wears its own block avatar.'
  },
  {
    title: 'Talyx, the manager',
    description: 'A manager bot that hands work to the other bots and briefs you.'
  },
  {
    title: 'One chat per bot',
    description:
      'Approvals and questions arrive as cards. Add images, dictate a message, and pick the model and how hard it reasons.'
  },
  {
    title: 'Bot details',
    description:
      'Title, description, model, routines, look and SOUL in one panel. Create a bot from the roster.'
  },
  {
    title: 'Group rooms',
    description: 'Several bots answer in one conversation, hosted by the engine.'
  },
  {
    title: 'Settings',
    description:
      'Model providers (API keys, account sign-ins and custom endpoints), the engine, launch at login and the theme.'
  },
  {
    title: 'First-run setup',
    description:
      'Installs the engine for your user only, with no admin password, then helps you add a provider and a first bot.'
  },
  {
    title: 'Updates you start',
    description:
      'Talyx tells you when a new release is out. Click Download and it fetches the installer, checks it against the release’s SHA256SUMS and opens it.'
  }
]

/** Not in 1.0, from the release notes. No dates: these are the gaps, not promises. */
const next: RoadmapItem[] = [
  {
    title: 'Windows',
    description: 'It comes once the engine runs there.'
  },
  {
    title: 'Remote engines',
    description: 'Talyx attaches only to an engine on the same computer for now.'
  },
  {
    title: 'The model’s reasoning',
    description: 'The transcript shows each answer, but not the reasoning behind it yet.'
  },
  {
    title: 'Voice mode',
    description: 'You can dictate a message today. Spoken conversations come later.'
  },
  {
    title: 'Other languages',
    description: 'The app is in English only for now.'
  }
]

const later: RoadmapItem[] = [
  {
    title: 'Remote machines',
    description:
      'Use Talyx on one computer with bots that run on another. How it works is decided once 1.0 has been in daily use.'
  }
]

const SHIPPED_SCREENS = [
  { src: '/previews/chat.jpg', alt: 'Talyx: the roster and a chat with Talyx' },
  { src: '/previews/details.jpg', alt: 'A bot’s details panel in Talyx' },
  { src: '/previews/room.jpg', alt: 'A group room in Talyx' }
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
        lead="What Talyx 1.0 does today, what comes next and what comes after."
      >
        <AppScreenshot src="/previews/chat.jpg" alt="Talyx: the roster and a chat with Talyx" />
      </PageHero>

      <StatusSection
        title="In 1.0"
        lead="Everything here is in the app you can download today."
        items={shipped}
      >
        <ul className="mt-12 grid gap-10 md:grid-cols-3">
          {SHIPPED_SCREENS.map(({ src, alt }, i) => (
            <li key={src} data-reveal style={stagger(i)}>
              <AppScreenshot src={src} alt={alt} />
            </li>
          ))}
        </ul>
      </StatusSection>
      <StatusSection title="Next" lead="Not in 1.0. These come first." items={next} />
      <StatusSection
        title="Later"
        lead="Further out, and shaped by how 1.0 gets used."
        items={later}
      />

      <section className={`${GUTTER} grid gap-12 py-16 md:grid-cols-12 md:py-24`}>
        <div className="md:col-span-4">
          <SectionHeading>Ask for it</SectionHeading>
        </div>
        <p
          data-reveal
          className="max-w-[40ch] leading-snug text-[var(--color-text-primary)] md:col-span-8"
          style={STEP.lead}
        >
          Missing something you need?{' '}
          <a
            href={ISSUES_URL}
            className="font-semibold underline underline-offset-4 transition-opacity hover:opacity-70"
          >
            Ask for it in a GitHub issue
          </a>
          . Issues are public, and requests there help decide what comes next.
        </p>
      </section>

      <DownloadSection />
    </>
  )
}
