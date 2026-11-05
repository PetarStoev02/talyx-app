import { ASSETS, DOWNLOADS, REPO_URL } from './release'

/** Every feature page the header's menus and the footer link to. */
export interface FeatureNav {
  slug: string
  title: string
  shortDescription: string
  /** A screenshot of the app view that does this, from /previews; null when no single screen shows it. */
  preview: string | null
}

export const features = [
  {
    slug: 'roster',
    title: 'Roster',
    shortDescription: 'Every bot in one list, with pins, folders and what each one is doing.',
    preview: '/previews/chat.jpg'
  },
  {
    slug: 'manager',
    title: 'Talyx, the manager',
    shortDescription: 'Ask Talyx and it hands the work to the right bot, then briefs you.',
    preview: '/previews/chat.jpg'
  },
  {
    slug: 'rooms',
    title: 'Group rooms',
    shortDescription: 'Two to six bots in one conversation, hosted by the engine.',
    preview: '/previews/room.jpg'
  },
  {
    slug: 'routines',
    title: 'Routines',
    shortDescription: 'Jobs a bot runs on a schedule, even with Talyx closed.',
    preview: '/previews/details.jpg'
  },
  {
    slug: 'bot-details',
    title: 'Bot details',
    shortDescription: 'A bot\u2019s title, model, look and SOUL in one panel.',
    preview: '/previews/details.jpg'
  },
  {
    slug: 'models-and-keys',
    title: 'Models and keys',
    shortDescription: 'Use your own API keys, account sign-ins or custom endpoints.',
    preview: '/previews/details.jpg'
  },
  {
    slug: 'privacy',
    title: 'Privacy',
    shortDescription: 'No account, no server and no telemetry in the app.',
    preview: null
  }
] as const satisfies readonly FeatureNav[]

/** The slugs of the feature pages; each one needs a page in featurePages.ts. */
export type FeatureSlug = (typeof features)[number]['slug']

export const resources = [
  { to: '/roadmap', title: 'Roadmap', shortDescription: 'What is shipped and what is next.' },
  { to: '/press', title: 'Press kit', shortDescription: 'Logos, screenshots and the facts.' },
  { to: '/contact', title: 'Contact', shortDescription: 'Questions, bugs and ideas.' }
] as const

/** A link in a menu or the footer: a route in this site, or a plain URL. */
export type NavLink =
  | { label: string; to: '/features/$slug'; params: { slug: string } }
  | { label: string; to: (typeof resources)[number]['to'] }
  | { label: string; href: string; /** The installer file, for download links. */ asset?: string }

export interface NavGroup {
  title: string
  links: NavLink[]
}

// The groups the phone menu and the footer list, in that order.
export const PRODUCT_GROUP: NavGroup = {
  title: 'Product',
  links: features.map(({ slug, title }) => ({
    label: title,
    to: '/features/$slug',
    params: { slug }
  }))
}

export const RESOURCES_GROUP: NavGroup = {
  title: 'Resources',
  links: resources.map(({ to, title }) => ({ label: title, to }))
}

/** One link per installer file in the latest release. */
export const INSTALLER_LINKS: NavLink[] = [
  { label: 'macOS, Apple Silicon', href: DOWNLOADS.appleSilicon, asset: ASSETS.appleSilicon },
  { label: 'macOS, Intel', href: DOWNLOADS.intel, asset: ASSETS.intel },
  { label: 'Linux, AppImage', href: DOWNLOADS.appImage, asset: ASSETS.appImage },
  { label: 'Linux, deb', href: DOWNLOADS.deb, asset: ASSETS.deb }
]

export const DOWNLOAD_GROUP: NavGroup = {
  title: 'Download',
  links: [...INSTALLER_LINKS, { label: 'Source on GitHub', href: REPO_URL }]
}

/** A page asked for navigation data under a slug that navigation.ts does not list. */
export class UnknownSlugError extends Error {
  constructor(slug: string) {
    super(`No feature with slug "${slug}" in navigation.ts`)
    this.name = 'UnknownSlugError'
  }
}

export function featureBySlug(slug: string): FeatureNav {
  const feature = features.find((f) => f.slug === slug)
  if (!feature) throw new UnknownSlugError(slug)
  return feature
}
