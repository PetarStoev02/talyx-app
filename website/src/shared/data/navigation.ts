/** Every feature page the header's menus and the footer link to. */
export interface FeatureNav {
  slug: string
  title: string
  shortDescription: string
  /** A screenshot of the app view that does this, from /previews; null when no single screen shows it. */
  preview: string | null
}

export const features: FeatureNav[] = [
  {
    slug: 'roster',
    title: 'Roster',
    shortDescription: 'Every bot in one list, with pins, folders and unread marks.',
    preview: null
  },
  {
    slug: 'manager',
    title: 'The manager bot',
    shortDescription: 'Talyx delegates to your other bots and briefs you on the result.',
    preview: null
  },
  {
    slug: 'rooms',
    title: 'Group rooms',
    shortDescription: 'Several bots in one chat, with approvals when they ask.',
    preview: null
  },
  {
    slug: 'routines',
    title: 'Routines',
    shortDescription: 'Jobs a bot runs on a schedule, managed from its details panel.',
    preview: null
  },
  {
    slug: 'bot-details',
    title: 'Bot details',
    shortDescription: 'A bot\u2019s title, model, look and SOUL in one panel.',
    preview: null
  },
  {
    slug: 'models-and-keys',
    title: 'Models and keys',
    shortDescription: 'Add API keys, sign in with an account, or point at a custom endpoint.',
    preview: null
  },
  {
    slug: 'privacy',
    title: 'Privacy',
    shortDescription: 'No account, no server and no telemetry in the app.',
    preview: null
  }
]

export const resources = [
  { to: '/roadmap', title: 'Roadmap', shortDescription: 'What is shipped and what is next.' },
  { to: '/press', title: 'Press kit', shortDescription: 'Logos, screenshots and the facts.' },
  { to: '/contact', title: 'Contact', shortDescription: 'Questions, bugs and ideas.' }
] as const

/** A link in a menu or the footer: a route in this site, or a plain URL. */
export type NavLink =
  | { label: string; to: '/features/$slug'; params: { slug: string } }
  | { label: string; to: (typeof resources)[number]['to'] }
  | { label: string; href: string }

export interface NavGroup {
  title: string
  links: NavLink[]
}

/** Every page, grouped the way the phone menu and the footer list them. */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Product',
    links: features.map(({ slug, title }) => ({
      label: title,
      to: '/features/$slug',
      params: { slug }
    }))
  },
  {
    title: 'Resources',
    links: resources.map(({ to, title }) => ({ label: title, to }))
  }
]

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
