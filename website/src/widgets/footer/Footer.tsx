import { Link } from '@tanstack/react-router'
import { DOWNLOADS, ISSUES_URL, REPO_URL, SECURITY_REPORT_URL } from '../../shared/data/release'
import { TalyxLogo } from '../../shared/ui/icons'
import { ThemeSwitcher } from '../../features/theme/ThemeSwitcher'
import { useTheme } from '../../features/theme/useTheme'

export function Footer() {
  const { theme, setTheme } = useTheme()

  return (
    <footer className="mt-auto border-t border-[var(--color-border)] px-4 pt-12 pb-6 sm:px-6 sm:pt-16 sm:pb-8">
      <div className="mx-auto max-w-[1200px]">
        {/* Footer columns */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 sm:gap-8 md:grid-cols-[1fr_1fr_1fr_1fr_auto]">
          {/* Features */}
          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-primary)]">
              Features
            </h4>
            <ul className="space-y-3">
              <li>
                <Link
                  to="/features/$slug"
                  params={{ slug: 'ai-classification' }}
                  className="text-sm text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
                >
                  AI Classification
                </Link>
              </li>
              <li>
                <Link
                  to="/features/$slug"
                  params={{ slug: 'watch-folders' }}
                  className="text-sm text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
                >
                  Watch Folders
                </Link>
              </li>
              <li>
                <Link
                  to="/features/$slug"
                  params={{ slug: 'smart-rename' }}
                  className="text-sm text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
                >
                  Smart Rename
                </Link>
              </li>
              <li>
                <Link
                  to="/features/$slug"
                  params={{ slug: 'privacy-offline' }}
                  className="text-sm text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
                >
                  Privacy & Offline
                </Link>
              </li>
              <li>
                <Link
                  to="/features/$slug"
                  params={{ slug: 'assistant' }}
                  className="text-sm text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
                >
                  The Assistant
                </Link>
              </li>
            </ul>
          </div>

          {/* Use Cases */}
          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-primary)]">
              Use Cases
            </h4>
            <ul className="space-y-3">
              <li>
                <Link
                  to="/use-cases/$slug"
                  params={{ slug: 'knowledge-workers' }}
                  className="text-sm text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
                >
                  Knowledge Workers
                </Link>
              </li>
              <li>
                <Link
                  to="/use-cases/$slug"
                  params={{ slug: 'freelancers' }}
                  className="text-sm text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
                >
                  Freelancers
                </Link>
              </li>
              <li>
                <Link
                  to="/use-cases/$slug"
                  params={{ slug: 'students' }}
                  className="text-sm text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
                >
                  Students
                </Link>
              </li>
              <li>
                <Link
                  to="/use-cases/$slug"
                  params={{ slug: 'legal' }}
                  className="text-sm text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
                >
                  Legal & Compliance
                </Link>
              </li>
              <li>
                <Link
                  to="/use-cases/$slug"
                  params={{ slug: 'medical' }}
                  className="text-sm text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
                >
                  Medical & Healthcare
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-primary)]">
              Resources
            </h4>
            <ul className="space-y-3">
              <li>
                <Link
                  to="/blog"
                  className="text-sm text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
                >
                  Blog
                </Link>
              </li>
              <li>
                <Link
                  to="/press"
                  className="text-sm text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
                >
                  Press Kit
                </Link>
              </li>
              <li>
                <Link
                  to="/roadmap"
                  className="text-sm text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
                >
                  Roadmap
                </Link>
              </li>
              <li>
                <a
                  href={ISSUES_URL}
                  className="text-sm text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
                >
                  Issues on GitHub
                </a>
              </li>
              <li>
                <a
                  href={REPO_URL}
                  className="text-sm text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
                >
                  Source on GitHub
                </a>
              </li>
              <li>
                <Link
                  to="/contact"
                  className="text-sm text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
                >
                  Contact
                </Link>
              </li>
              <li>
                <a
                  href={SECURITY_REPORT_URL}
                  className="text-sm text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
                >
                  Report a security issue
                </a>
              </li>
            </ul>
          </div>

          {/* Download */}
          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-primary)]">
              Download
            </h4>
            <ul className="space-y-3">
              <li>
                <a
                  href={DOWNLOADS.appleSilicon}
                  className="text-sm text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
                >
                  macOS — Apple Silicon
                </a>
              </li>
              <li>
                <a
                  href={DOWNLOADS.intel}
                  className="text-sm text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
                >
                  macOS — Intel
                </a>
              </li>
            </ul>
          </div>

          {/* Logo column */}
          <div className="flex justify-start md:justify-end">
            <TalyxLogo />
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-[var(--color-border)] pt-6 sm:mt-16 sm:pt-8 sm:flex-row">
          <p className="text-sm text-[var(--color-text-tertiary)]">
            &copy; {new Date().getFullYear()} Talyx · MIT licensed
          </p>
          <div className="flex items-center gap-4">
            <Link
              to="/legal/$slug"
              params={{ slug: 'privacy' }}
              className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
            >
              Privacy
            </Link>
            <Link
              to="/legal/$slug"
              params={{ slug: 'terms' }}
              className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
            >
              Terms
            </Link>
            <a
              href="/OFL-Geist.txt"
              className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
            >
              Set in Geist, SIL Open Font License
            </a>
            <ThemeSwitcher theme={theme} setTheme={setTheme} />
          </div>
        </div>
      </div>
    </footer>
  )
}
