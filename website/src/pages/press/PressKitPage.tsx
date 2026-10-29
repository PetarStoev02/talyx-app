import { ISSUES_URL, REPO_URL } from '../../shared/data/release'
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
  { label: 'Founded', value: '2026' },
  { label: 'Category', value: 'Productivity / File Management' },
  { label: 'Platform', value: 'macOS' },
  { label: 'Licence', value: 'Free and open source (MIT)' },
  { label: 'AI', value: 'Sorts on-device by default; Your Claude optional' },
  { label: 'Tech', value: 'Electron, React, TypeScript, MCP' }
]

const SCREENSHOTS = [
  { src: '/previews/suggestions.jpg', caption: 'The assistant' },
  { src: '/previews/sort.jpg', caption: 'Sort' },
  { src: '/previews/watch.jpg', caption: 'Watch folders' },
  { src: '/previews/history.jpg', caption: 'History and undo' }
]

const BOILERPLATE = [
  { title: 'Tagline', text: 'Your AI. Your files. Organized.' },
  {
    title: 'Short description, 50 words',
    text: 'Talyx is a macOS desktop app that sorts your files by type and metadata on your Mac, with no cloud, no API keys, and no setup. Your own Claude is an optional upgrade that sorts by what’s inside, suggests renames, and powers the hotkey assistant. Free and open source (MIT).'
  },
  {
    title: 'Long description, about 90 words',
    text: 'Talyx brings AI-powered file organization to your desktop. Drop a folder and Smart sorting classifies every file (documents, images, videos, spreadsheets) into logical categories on-device, by default, with no cloud APIs or subscriptions. Turn on Your Claude to have the whole batch sorted with a semantic understanding of names, metadata and extracted text. Set up watch folders to auto-sort incoming files, let Your Claude suggest meaningful names based on their contents, and undo any operation with a single click. Talyx is free and open source under the MIT licence.'
  }
]

const ASSETS = [
  { label: 'Logo (SVG)', description: 'Vector logo for web and print', href: '/talyx-logo.svg' },
  { label: 'App icon (PNG)', description: '512x512 app icon', href: '/talyx-icon-512.png' }
]

const HIGHLIGHTS = [
  {
    title: 'Smart sorting by default',
    text: 'Classifies files on your device with no cloud APIs and no setup required; Your Claude is an optional upgrade.'
  },
  {
    title: 'The assistant',
    text: 'Cmd+Shift+Space anywhere; calendar, reminders, notes, mail, music, system toggles, files and code, each shown on a card before it runs; voice in and out, processed on-device.'
  },
  {
    title: 'Bring your own Claude',
    text: 'Runs on your Anthropic API key or your signed-in Claude Code subscription; no Talyx account, no markup.'
  },
  {
    title: 'Privacy-first',
    text: 'Smart sorting, the default, classifies locally with no file content leaving your machine. Turning on Your Claude sends the whole sort batch to your own Claude account: file names, metadata and the first 2,000 characters of extracted text, with currency amounts, dates and company names ending in a legal suffix masked, best-effort.'
  },
  { title: 'Native macOS app', text: 'Built for Apple Silicon and Intel.' }
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
        lead="Everything you need to write about Talyx. Brand assets, product details, and key facts."
      />

      <PressSection title="About Talyx">
        <div data-reveal className="space-y-6">
          <Body>
            Talyx is a personal AI assistant for the Mac. Press a shortcut, say what you want in
            your own words, and your own Claude (an Anthropic API key or the Claude Code you already
            have) plans the steps and acts after you approve. File sorting is one of its abilities.
            It uses Smart sorting by default, classifying on your device from file names and
            metadata, with no cloud APIs and no setup; Your Claude is an optional upgrade.
          </Body>
          <Body>
            Built for people drowning in messy Downloads folders and scattered documents, Talyx
            leverages the AI you already use to understand file contents and organize them into
            logical categories. It supports smart file renaming, watch folders for automatic
            sorting, and undo for whole sort batches.
          </Body>
        </div>
        <ul className="mt-16 grid gap-x-10 gap-y-10 sm:grid-cols-2">
          {HIGHLIGHTS.map(({ title, text }, i) => (
            <li key={title} data-reveal style={stagger(i)}>
              <ItemTitle>{title}</ItemTitle>
              <Body className="mt-3">{text}</Body>
            </li>
          ))}
        </ul>
        <Body className="mt-16">
          Talyx is available for macOS. It is free and open source under the MIT licence, with the
          source on GitHub.
        </Body>
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
            <li key={src} data-reveal style={stagger(i)}>
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
          Please do not alter, rotate, or recolor the Talyx logo. Use the logo on light or dark
          backgrounds as provided.
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
