export const CATEGORIES = [
  'Documents',
  'Images',
  'Videos',
  'Audio',
  'Code',
  'Software',
  'Archives',
  'Other'
] as const

export type Category = (typeof CATEGORIES)[number]

export interface TaxonomyPath {
  category: Category
  subcategory: string | null
}

/**
 * Forces a classification into the real taxonomy. Language models invent paths
 * under uncertainty — `Reports/analysis`, `Documents/Documents`, `Audio/Audiobooks` —
 * and an unvalidated path becomes a stray top-level folder on disk.
 *
 * An invented category that names a real subcategory is rehomed under its parent,
 * so `Reports/analysis` lands where the model meant: `Documents/Reports`.
 */
export function coerceToTaxonomy(category: string, subcategory: string | null): TaxonomyPath {
  const validCategory = matchCategory(category)

  if (!validCategory) {
    const rehomed = rehomeSubcategory(category)
    if (rehomed) return rehomed
    return { category: 'Other', subcategory: subcategory === null ? null : 'Other' }
  }

  if (subcategory === null) return { category: validCategory, subcategory: null }

  return {
    category: validCategory,
    subcategory: matchSubcategory(validCategory, subcategory) ?? 'Other'
  }
}

/**
 * Strict check for a path a caller asserts is correct — a user correction or an
 * MCP client. Unlike {@link coerceToTaxonomy}, this rejects rather than repairs,
 * so a caller's stated intent is never silently rewritten.
 */
export function isValidTaxonomyPath(category: string, subcategory: string | null): boolean {
  if (!(CATEGORIES as readonly string[]).includes(category)) return false
  if (subcategory === null) return true
  return SUBCATEGORIES[category as Category].includes(subcategory)
}

function matchCategory(name: string): Category | null {
  const needle = name.trim().toLowerCase()
  return CATEGORIES.find((c) => c.toLowerCase() === needle) ?? null
}

function matchSubcategory(category: Category, name: string): string | null {
  // Models invent singular forms ("Clip", "Recording") — accept them as their plural
  const needle = name.trim().toLowerCase()
  const accepted = new Set([needle, `${needle}s`])
  return SUBCATEGORIES[category].find((s) => accepted.has(s.toLowerCase())) ?? null
}

export function rehomeSubcategory(name: string): TaxonomyPath | null {
  for (const category of CATEGORIES) {
    const match = matchSubcategory(category, name)
    if (match) return { category, subcategory: match }
  }
  return null
}

export const SUBCATEGORIES: Record<Category, readonly string[]> = {
  Documents: [
    'Invoices',
    'Reports',
    'Contracts',
    'Legal',
    'Investment',
    'Resumes',
    'Spreadsheets',
    'Presentations',
    'Ebooks',
    'Other'
  ],
  Images: ['Photos', 'Screenshots', 'Graphics', 'Icons', 'Vectors', 'Other'],
  Videos: ['Movies', 'Clips', 'Screencasts', 'Animations', 'Other'],
  Audio: ['Music', 'Recordings', 'Podcasts', 'Audiobooks', 'Sound Effects', 'Other'],
  Code: ['JavaScript', 'TypeScript', 'Python', 'Web', 'Systems', 'Data', 'Shell', 'Other'],
  Software: ['Installers', 'Disk Images', 'Packages', 'Application Data', 'Other'],
  Archives: ['Compressed', 'Other'],
  Other: ['3D Models', 'CAD', 'Fonts', 'Torrents', 'Other']
}
