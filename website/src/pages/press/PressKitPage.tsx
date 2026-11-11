import { features } from '../../shared/data/navigation'
import { MIN_MACOS } from '../../shared/data/offer'
import { APP_VERSION, ISSUES_URL, REPO_URL } from '../../shared/data/release'
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

const FACTS = [
  { label: 'Version', value: APP_VERSION },
  { label: 'Category', value: 'Desktop app for AI agents' },
  {
    label: 'Platforms',
    value: `${MIN_MACOS} or newer (Apple Silicon and Intel) and Linux x64. Windows comes later.`
  },
  { label: 'Price', value: 'Free, with no account' },
  { label: 'Licence', value: 'Open source (AGPL-3.0)' },
  { label: 'Runs on', value: 'The engine, an agent backend that first-run setup installs' },
  { label: 'Models', value: 'Your own: API keys, account sign-ins or custom endpoints' },
  { label: 'Built with', value: 'Electron, React, TypeScript' }
]

const SCREENSHOTS = [
  { src: '/previews/chat.jpg', caption: 'The roster and a chat with Talyx' },
  { src: '/previews/details.jpg', caption: 'A bot\u2019s details panel' },
  { src: '/previews/room.jpg', caption: 'A group room' }
]

const BOILERPLATE = [
  { title: 'Tagline', text: 'Your bots, in one place.' },
  {
    title: 'Short description, 50 words',
    text: 'Talyx is a free, open-source desktop app for your AI bots, on macOS and Linux. A roster lists every bot and one chat talks to each. Talyx, the manager bot, hands work to the other bots and briefs you. The bots run on the engine, which Talyx installs during setup.'
  },
  {
    title: 'Long description, about 90 words',
    text: 'Talyx is a desktop app to tally your AI agents. The roster on the left lists every bot, with pins, folders, unread marks and what each bot is doing. The chat on the right talks to the selected bot, with approvals and questions as cards. Talyx, the manager bot, hands work to the other bots and briefs you. Group rooms let several bots answer in one conversation. The bots run on the engine, which first-run setup installs. Talyx is free and open source under the AGPL-3.0 licence, for macOS and Linux.'
  }
]

const ASSETS = [
  { label: 'Logo (SVG)', description: 'Vector logo for web and print', href: '/talyx-logo.svg' },
  { label: 'App icon (PNG)', description: '512x512 app icon', href: '/talyx-icon-512.png' }
]

const linkClass =
  'font-semibold text-[var(--color-text-primary)] underline underline-offset-4 transition-opacity hover:opacity-70'

/** A section: heading on the left, content on the right, the way the landing page sets it. */
function PressSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={`${GUTTER} grid gap-12 py-16 md:grid-cols-12 md:py-24`}>
      <div className="md:sticky md:top-28 md:col-span-4 md:self-start">
        <SectionHeading>{title}</SectionHeading>
      </div>
      <div className="md:col-span-8">{children}</div>
    </section>
  )
}

export function PressKitPage() {
  return (
    <>
      <PageHero
        title="Press kit"
        lead="Facts, screenshots, descriptions and logos for writing about Talyx 1.0."
      >
        <AppScreenshot src="/previews/chat.jpg" alt="Talyx: the roster and a chat with Talyx" />
      </PageHero>

      <PressSection title="About Talyx">
        <div data-reveal className="space-y-6">
          <Body>
            Talyx is a free desktop app for your AI bots, on macOS and Linux. A roster of bots sits
            on the left and one chat on the right. Talyx, the manager bot, hands work to the other
            bots and briefs you.
          </Body>
          <Body>
            The bots run on the engine, a separate agent backend on your computer that Talyx
            installs during first-run setup. Each bot uses the models you choose, through your own
            API keys, account sign-ins or custom endpoints. Talyx has no account, no server and no
            telemetry.
          </Body>
        </div>
        <ul className="mt-16 grid gap-x-10 gap-y-10 sm:grid-cols-2">
          {features.map(({ slug, title, shortDescription }, i) => (
            <li key={slug} data-reveal style={stagger(i % 4)}>
              <ItemTitle>{title}</ItemTitle>
              <Body className="mt-3">{shortDescription}</Body>
            </li>
          ))}
        </ul>
      </PressSection>

      <PressSection title="Key facts">
        <dl className="space-y-8">
          {FACTS.map(({ label, value }, i) => (
            <div
              key={label}
              data-reveal
              style={stagger(i)}
              className="grid grid-cols-[minmax(0,2fr)_minmax(0,5fr)] items-baseline gap-6"
            >
              <dt className="text-[var(--color-text-secondary)]" style={STEP.body}>
                {label}
              </dt>
              <dd
                className="leading-snug font-semibold text-[var(--color-text-primary)]"
                style={STEP.lead}
              >
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </PressSection>

      <PressSection title="Screenshots">
        <ul className="grid gap-10 sm:grid-cols-2">
          {SCREENSHOTS.map(({ src, caption }, i) => (
            <li
              key={src}
              data-reveal
              style={stagger(i)}
              className={i === 0 ? 'sm:col-span-2' : undefined}
            >
              <AppScreenshot src={src} alt={`Talyx: ${caption}`} />
              <p className="mt-4" style={STEP.body}>
                <a href={src} download className={linkClass}>
                  {caption}
                </a>
              </p>
            </li>
          ))}
        </ul>
      </PressSection>

      <PressSection title="Boilerplate">
        <div className="space-y-12">
          {BOILERPLATE.map(({ title, text }, i) => (
            <div key={title} data-reveal style={stagger(i)}>
              <ItemTitle>{title}</ItemTitle>
              <Body className="mt-3">{text}</Body>
            </div>
          ))}
        </div>
      </PressSection>

      <PressSection title="Brand assets">
        <ul className="space-y-8">
          {ASSETS.map(({ label, description, href }, i) => (
            <li key={href} data-reveal style={stagger(i)}>
              <a href={href} download className={linkClass} style={STEP.lead}>
                {label}
              </a>
              <Body className="mt-2">{description}</Body>
            </li>
          ))}
        </ul>
        <Body className="mt-12">
          Use the logo as provided, on a light or dark background. Do not alter, rotate or recolour
          it.
        </Body>
      </PressSection>

      <PressSection title="Contact">
        <ul className="space-y-6" style={STEP.lead}>
          <li data-reveal>
            <a href={ISSUES_URL} className={linkClass}>
              Issues on GitHub
            </a>
          </li>
          <li data-reveal style={stagger(1)}>
            <a href={REPO_URL} className={linkClass}>
              Source on GitHub
            </a>
          </li>
        </ul>
      </PressSection>

      <DownloadSection />
    </>
  )
}
