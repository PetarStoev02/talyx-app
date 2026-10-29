import type { Plan } from './plan'

/**
 * Every page the header's menus and the footer link to. Each entry carries
 * what its preview shows: a screenshot of the real app, or the card Talyx
 * would put in front of that kind of user.
 */
export interface FeatureNav {
  slug: string
  title: string
  shortDescription: string
  /** A screenshot of the app view that does this, from /previews; null when no single screen shows it. */
  preview: string | null
}

export interface UseCaseNav {
  slug: string
  title: string
  shortDescription: string
  /** A sample of the approval card this user would see. */
  plan: Plan
}

export const features: FeatureNav[] = [
  {
    slug: 'assistant',
    title: 'The assistant',
    shortDescription: 'Press ⌘⇧Space and ask. Your own Claude plans it and asks first.',
    preview: '/previews/suggestions.jpg'
  },
  {
    slug: 'ai-classification',
    title: 'AI classification',
    shortDescription: 'Smart Local sorts on your Mac. Your Claude reads the contents too.',
    preview: '/previews/sort.jpg'
  },
  {
    slug: 'watch-folders',
    title: 'Watch folders',
    shortDescription: 'New files are sorted as they land.',
    preview: '/previews/watch.jpg'
  },
  {
    slug: 'smart-rename',
    title: 'Smart rename',
    shortDescription: 'scan_003.pdf becomes invoice_march.pdf.',
    preview: '/previews/sort.jpg'
  },
  {
    slug: 'sort-history',
    title: 'Sort history',
    shortDescription: 'Every sort recorded. Undo one file or a whole batch.',
    preview: '/previews/history.jpg'
  },
  {
    slug: 'drag-and-drop',
    title: 'Drag and drop',
    shortDescription: 'Drop a folder on Talyx and see the plan.',
    preview: '/previews/sort.jpg'
  },
  {
    slug: 'privacy-offline',
    title: 'Privacy and offline',
    shortDescription: 'Sorting stays on your Mac unless you choose Your Claude.',
    preview: null
  }
]

export const useCases: UseCaseNav[] = [
  {
    slug: 'knowledge-workers',
    title: 'Knowledge workers',
    shortDescription: 'Downloads, meetings and mail, kept in order.',
    plan: {
      summary: 'Sort 62 files in Downloads into 8 folders',
      steps: [
        '18 PDFs → Documents/Reports',
        '9 decks → Documents/Presentations',
        '35 screenshots → Images/Screenshots'
      ],
      needsApproval: true
    }
  },
  {
    slug: 'freelancers',
    title: 'Freelancers and creatives',
    shortDescription: 'Client files apart, invoices easy to find.',
    plan: {
      summary: 'File 14 invoices by client',
      steps: [
        'Northwind: 6 → Clients/Northwind/Invoices',
        'Acme Studio: 5 → Clients/Acme/Invoices',
        'Personal: 3 → Documents/Invoices'
      ],
      needsApproval: true
    }
  },
  {
    slug: 'students',
    title: 'Students and researchers',
    shortDescription: 'Papers, notes and datasets by course.',
    plan: {
      summary: 'Sort 23 lecture PDFs by course',
      steps: [
        'Biology 201: 9 → Semester 2/Biology',
        'Statistics: 8 → Semester 2/Statistics',
        'Ethics: 6 → Semester 2/Ethics'
      ],
      needsApproval: true
    }
  },
  {
    slug: 'legal',
    title: 'Legal and compliance',
    shortDescription: 'Confidential documents sorted on your Mac.',
    plan: {
      summary: 'Sort 31 documents with Smart Local',
      steps: [
        'Nothing leaves this Mac',
        '12 contracts → Matters/Contracts',
        '19 filings → Matters/Filings'
      ],
      needsApproval: true
    }
  },
  {
    slug: 'medical',
    title: 'Medical and healthcare',
    shortDescription: 'Records and research, sorted on-device by default.',
    plan: {
      summary: 'Sort 40 research files with Smart Local',
      steps: [
        'Nothing leaves this Mac',
        '22 papers → Research/Papers',
        '18 datasets → Research/Data'
      ],
      needsApproval: true
    }
  }
]

export const resources = [
  { to: '/blog', title: 'Blog', shortDescription: 'Releases and how Talyx is built.' },
  { to: '/roadmap', title: 'Roadmap', shortDescription: 'What is shipped and what is next.' },
  { to: '/press', title: 'Press kit', shortDescription: 'Logos, screenshots and the facts.' },
  { to: '/contact', title: 'Contact', shortDescription: 'Questions, bugs and ideas.' }
] as const

/** A link in a menu or the footer: a route in this site, or a plain URL. */
export type NavLink =
  | { label: string; to: '/features/$slug' | '/use-cases/$slug'; params: { slug: string } }
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
    title: 'Use cases',
    links: useCases.map(({ slug, title }) => ({
      label: title,
      to: '/use-cases/$slug',
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
  constructor(kind: 'feature' | 'use case', slug: string) {
    super(`No ${kind} with slug "${slug}" in navigation.ts`)
    this.name = 'UnknownSlugError'
  }
}

export function featureBySlug(slug: string): FeatureNav {
  const feature = features.find((f) => f.slug === slug)
  if (!feature) throw new UnknownSlugError('feature', slug)
  return feature
}

export function useCaseBySlug(slug: string): UseCaseNav {
  const useCase = useCases.find((u) => u.slug === slug)
  if (!useCase) throw new UnknownSlugError('use case', slug)
  return useCase
}
