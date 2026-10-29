export type BlogCategory = 'product' | 'guides' | 'comparisons' | 'engineering' | 'privacy'

export interface BlogPost {
  slug: string
  title: string
  excerpt: string
  date: string
  updatedAt?: string
  readTime: string
  /** A screenshot of the part of Talyx the post is about, from /previews. */
  cover: string
  category: BlogCategory
  draft: boolean
  featured?: boolean
}

export const categoryMeta: Record<BlogCategory, { label: string }> = {
  product: { label: 'Product' },
  guides: { label: 'Guides' },
  comparisons: { label: 'Comparisons' },
  engineering: { label: 'Engineering' },
  privacy: { label: 'Privacy' }
}

export const posts: BlogPost[] = [
  {
    slug: 'talyx-is-now-free-and-open-source',
    title: 'Talyx is now free and open source',
    excerpt: "Why I'm giving Talyx away, and what changes for you.",
    date: '2026-10-12',
    readTime: '3 min read',
    cover: '/previews/sort.jpg',
    category: 'product',
    draft: false,
    featured: true
  },
  {
    slug: 'meet-the-assistant',
    title: 'Meet the assistant: your Claude runs your Mac',
    excerpt:
      'Talyx 0.9.0 adds a hotkey overlay where your own Claude — an API key or your signed-in Claude Code — plans what you ask, shows a card, and acts when you approve. Here is what it does and how it stays safe.',
    date: '2026-09-17',
    updatedAt: '2026-09-18',
    readTime: '6 min read',
    cover: '/previews/suggestions.jpg',
    category: 'product',
    draft: false
  }
]

export function getPostBySlug(slug: string): BlogPost | undefined {
  return posts.find((p) => p.slug === slug)
}
