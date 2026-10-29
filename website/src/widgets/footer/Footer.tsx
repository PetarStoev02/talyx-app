import { Link } from '@tanstack/react-router'
import { DOWNLOADS, ISSUES_URL, REPO_URL, SECURITY_REPORT_URL } from '../../shared/data/release'
import { NAV_GROUPS, type NavGroup } from '../../shared/data/navigation'
import { NavAnchor } from '../../shared/ui/NavAnchor'
import { ThemeSwitcher } from '../../features/theme/ThemeSwitcher'
import { useTheme } from '../../features/theme/useTheme'

const [product, useCases, resources] = NAV_GROUPS

const COLUMNS: NavGroup[] = [
  product,
  useCases,
  {
    ...resources,
    links: [
      ...resources.links,
      { label: 'Issues on GitHub', href: ISSUES_URL },
      { label: 'Report a security issue', href: SECURITY_REPORT_URL }
    ]
  },
  {
    title: 'Download',
    links: [
      { label: 'macOS, Apple Silicon', href: DOWNLOADS.appleSilicon },
      { label: 'macOS, Intel', href: DOWNLOADS.intel },
      { label: 'Source on GitHub', href: REPO_URL }
    ]
  }
]

const LINK_CLASS =
  'text-[15px] text-[var(--color-text-primary)] transition-opacity hover:opacity-60'

/** The site map, then the name again at full width. */
export function Footer() {
  const { theme, setTheme } = useTheme()

  return (
    <footer className="mt-auto overflow-hidden bg-[var(--color-bg-secondary)] px-5 pt-24 pb-8 sm:px-8">
      <nav aria-label="Site map" className="grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-4">
        {COLUMNS.map(({ title, links }) => (
          <div key={title}>
            <h2 className="text-[15px] font-semibold text-[var(--color-text-secondary)]">
              {title}
            </h2>
            <ul className="mt-4 space-y-3">
              {links.map((link) => (
                <li key={link.label}>
                  <NavAnchor link={link} className={LINK_CLASS} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <p
        aria-hidden="true"
        className="mt-24 leading-[0.95] font-semibold tracking-[-0.06em] text-[var(--color-text-primary)] select-none"
        style={{ fontSize: '42vw' }}
      >
        Talyx
      </p>

      <div className="mt-8 flex flex-col gap-4 text-[14px] text-[var(--color-text-secondary)] sm:flex-row sm:items-center sm:justify-between">
        <p>&copy; {new Date().getFullYear()} Talyx · MIT licensed · Set in Geist</p>
        <div className="flex flex-wrap items-center gap-5">
          <Link
            to="/legal/$slug"
            params={{ slug: 'privacy' }}
            className="hover:text-[var(--color-text-primary)]"
          >
            Privacy
          </Link>
          <Link
            to="/legal/$slug"
            params={{ slug: 'terms' }}
            className="hover:text-[var(--color-text-primary)]"
          >
            Terms
          </Link>
          <a href="/OFL-Geist.txt" className="hover:text-[var(--color-text-primary)]">
            Font licence
          </a>
          <ThemeSwitcher theme={theme} setTheme={setTheme} />
        </div>
      </div>
    </footer>
  )
}
