import { Link } from '@tanstack/react-router'
import { DOWNLOADS, ISSUES_URL, REPO_URL, SECURITY_REPORT_URL } from '../../shared/data/release'
import { features, resources, useCases } from '../../shared/data/navigation'
import { ThemeSwitcher } from '../../features/theme/ThemeSwitcher'
import { useTheme } from '../../features/theme/useTheme'

type FooterLink =
  | { label: string; to: string; params?: { slug: string } }
  | { label: string; href: string }

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Product',
    links: features.map(({ slug, title }) => ({
      label: title,
      to: '/features/$slug',
      params: { slug }
    }))
  },
  {
    title: 'Use cases',
    links: useCases.map(({ slug, title }) => ({
      label: title,
      to: '/use-cases/$slug',
      params: { slug }
    }))
  },
  {
    title: 'Resources',
    links: [
      ...resources.map(({ to, title }) => ({ label: title, to })),
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

function FooterAnchor({ link }: { link: FooterLink }) {
  if ('href' in link)
    return (
      <a href={link.href} className={LINK_CLASS}>
        {link.label}
      </a>
    )
  return (
    <Link to={link.to} params={link.params} className={LINK_CLASS}>
      {link.label}
    </Link>
  )
}

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
                  <FooterAnchor link={link} />
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
