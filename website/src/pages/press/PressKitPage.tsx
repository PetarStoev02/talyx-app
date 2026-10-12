import { Download, Github, Bug } from 'lucide-react'
import { ISSUES_URL, REPO_URL } from '../../shared/data/release'

const facts = [
  { label: 'Founded', value: '2026' },
  { label: 'Category', value: 'Productivity / File Management' },
  { label: 'Platform', value: 'macOS' },
  { label: 'Licence', value: 'Free and open source (MIT)' },
  { label: 'AI', value: 'Sorts on-device by default; Your Claude optional' },
  { label: 'Tech', value: 'Electron, React, TypeScript, MCP' }
]

const downloads = [
  {
    label: 'Logo (SVG)',
    description: 'Vector logo for web and print',
    href: '/talyx-logo.svg'
  },
  {
    label: 'App Icon (PNG)',
    description: '512x512 app icon',
    href: '/talyx-icon-512.png'
  }
]

export function PressKitPage() {
  return (
    <>
      {/* Hero */}
      <section className="px-4 pt-20 pb-12 sm:px-6 sm:pt-28 sm:pb-16">
        <div className="mx-auto max-w-[800px] text-center">
          <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-4xl">
            Press Kit
          </h1>
          <p className="mt-4 text-base text-[var(--color-text-secondary)] sm:text-lg">
            Everything you need to write about Talyx. Brand assets, product details, and key facts.
          </p>
        </div>
      </section>

      {/* About */}
      <section className="px-4 pb-12 sm:px-6 sm:pb-16">
        <div className="mx-auto max-w-[800px]">
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] sm:text-2xl">
            About Talyx
          </h2>
          <div className="mt-4 space-y-4 text-sm leading-relaxed text-[var(--color-text-secondary)] sm:text-base">
            <p>
              Talyx is a personal AI assistant for the Mac. Press a shortcut, say what you want in
              your own words, and your own Claude — an Anthropic API key or the Claude Code you
              already have — plans the steps and acts after you approve. File sorting is one of its
              abilities, and it sorts by Smart sorting by default — classifying on your device from
              file names and metadata, with no cloud APIs and no setup; Your Claude is an optional
              upgrade.
            </p>
            <p>
              Built for people drowning in messy Downloads folders and scattered documents, Talyx
              leverages the AI you already use to understand file contents and organize them into
              logical categories. It supports smart file renaming, watch folders for automatic
              sorting, and undo for whole sort batches.
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Smart sorting by default</strong> — classifies files on your device with no
                cloud APIs and no setup required; Your Claude is an optional upgrade
              </li>
              <li>
                <strong>The assistant</strong> — Cmd+Shift+Space anywhere; calendar, reminders,
                notes, mail, music, system toggles, files and code, each shown on a card before it
                runs; voice in and out, processed on-device
              </li>
              <li>
                <strong>Bring your own Claude</strong> — runs on your Anthropic API key or your
                signed-in Claude Code subscription; no Talyx account, no markup
              </li>
              <li>
                <strong>Privacy-first</strong> — Smart sorting, the default, classifies locally with
                no file content leaving your machine. Turning on Your Claude sends the whole sort
                batch to your own Claude account: file names, metadata and the first 2,000
                characters of extracted text, with currency amounts, dates and company names ending
                in a legal suffix masked, best-effort
              </li>
              <li>
                <strong>Native macOS app</strong> — built for Apple Silicon and Intel
              </li>
            </ul>
            <p>
              Talyx is available for macOS. It is free and open source under the MIT licence, with
              the source on GitHub.
            </p>
          </div>
        </div>
      </section>

      {/* Key Facts */}
      <section className="px-4 pb-12 sm:px-6 sm:pb-16">
        <div className="mx-auto max-w-[800px]">
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] sm:text-2xl">
            Key Facts
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {facts.map((fact) => (
              <div
                key={fact.label}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
              >
                <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  {fact.label}
                </p>
                <p className="mt-1 text-sm font-medium text-[var(--color-text-primary)]">
                  {fact.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* One-Liner & Descriptions */}
      <section className="px-4 pb-12 sm:px-6 sm:pb-16">
        <div className="mx-auto max-w-[800px]">
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] sm:text-2xl">
            Boilerplate
          </h2>
          <div className="mt-6 space-y-6">
            <div>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Tagline</h3>
              <p className="mt-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                Your AI. Your files. Organized.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                Short Description (50 words)
              </h3>
              <p className="mt-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                Talyx is a macOS desktop app that sorts your files by type and metadata on your Mac,
                with no cloud, no API keys, and no setup. Your own Claude is an optional upgrade
                that sorts by what’s inside, suggests renames, and powers the hotkey assistant. Free
                and open source (MIT).
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                Long Description (about 90 words)
              </h3>
              <p className="mt-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                Talyx brings AI-powered file organization to your desktop. Drop a folder and Smart
                sorting classifies every file — documents, images, videos, spreadsheets — into
                logical categories on-device, by default, with no cloud APIs or subscriptions. Turn
                on Your Claude to have the whole batch sorted with a semantic understanding of
                names, metadata and extracted text. Set up watch folders to auto-sort incoming
                files, let Your Claude suggest meaningful names based on their contents, and undo
                any operation with a single click. Talyx is free and open source under the MIT
                licence.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Brand Assets */}
      <section className="px-4 pb-12 sm:px-6 sm:pb-16">
        <div className="mx-auto max-w-[800px]">
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] sm:text-2xl">
            Brand Assets
          </h2>
          <div className="mt-6 space-y-3">
            {downloads.map((item) => (
              <a
                key={item.label}
                href={item.href}
                download
                className="flex items-center gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:bg-[var(--color-surface-hover)]"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-icon-bg)]">
                  <Download className="size-4 text-[var(--color-text-secondary)]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    {item.label}
                  </p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">{item.description}</p>
                </div>
              </a>
            ))}
          </div>
          <p className="mt-4 text-xs text-[var(--color-text-tertiary)]">
            Please do not alter, rotate, or recolor the Talyx logo. Use the logo on light or dark
            backgrounds as provided.
          </p>
        </div>
      </section>

      {/* Contact */}
      <section className="px-4 pb-20 sm:px-6 sm:pb-28">
        <div className="mx-auto max-w-[800px]">
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] sm:text-2xl">
            Contact
          </h2>
          <div className="mt-6 space-y-3">
            <a
              href={ISSUES_URL}
              className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
            >
              <Bug className="size-4" />
              Issues on GitHub
            </a>
            <a
              href={REPO_URL}
              className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
            >
              <Github className="size-4" />
              Source on GitHub
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
