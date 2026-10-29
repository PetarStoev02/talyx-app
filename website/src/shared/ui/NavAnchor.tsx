import { Link } from '@tanstack/react-router'
import type { NavLink } from '../data/navigation'

/** One menu or footer link: a router Link for a page here, a plain anchor for a URL. */
export function NavAnchor({ link, className }: { link: NavLink; className: string }) {
  if ('href' in link)
    return (
      <a href={link.href} className={className}>
        {link.label}
      </a>
    )
  if ('params' in link)
    return (
      <Link to={link.to} params={link.params} className={className}>
        {link.label}
      </Link>
    )
  return (
    <Link to={link.to} className={className}>
      {link.label}
    </Link>
  )
}
