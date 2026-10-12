import type { SearchIndexRepo } from '../repository/SearchIndexRepo'
import type { SearchResult } from '../model/SearchResult'
import { basename, dirname } from 'path'
import { existsSync } from 'fs'
import log from 'electron-log'
import { ExtensionClassifier } from '../../classification/services/ExtensionClassifier'

const MAX_RESULTS = 10

/** Structured intent parsed from natural language query */
interface SearchIntent {
  keywords: string[]
  category: string | null
}

/** Category keyword patterns for rule-based intent detection */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Images: [
    'image',
    'images',
    'photo',
    'photos',
    'picture',
    'pictures',
    'screenshot',
    'screenshots'
  ],
  Documents: ['document', 'documents', 'pdf', 'invoice', 'invoices', 'report', 'reports'],
  Audio: ['audio', 'music', 'song', 'songs', 'podcast', 'podcasts'],
  Videos: ['video', 'videos', 'clip', 'clips', 'movie', 'movies'],
  Code: ['code', 'script', 'scripts', 'source']
}

const STOP_WORDS = new Set([
  'find',
  'me',
  'the',
  'a',
  'an',
  'from',
  'my',
  'show',
  'get',
  'all',
  'of',
  'in',
  'for',
  'to'
])

export class SearchService {
  private readonly classifier = new ExtensionClassifier()

  constructor(private searchIndex: SearchIndexRepo) {}

  async search(query: string, limit: number = MAX_RESULTS): Promise<SearchResult[]> {
    if (!query.trim()) return []

    // Understand the query (rule-based intent parsing)
    const intent = this.parseIntent(query)
    log.info(`Search intent: ${JSON.stringify(intent)}`)

    // Get candidates from FTS5
    const keywords = intent.keywords.length > 0 ? intent.keywords.join(' ') : query
    // A hit can point at nothing: the file was trashed, moved in Finder, or put
    // back by an undo. Drop it, and forget the row unless its whole folder is
    // gone — an unplugged drive must not cost the owner their index.
    const candidates = this.searchIndex.searchKeyword(keywords, limit * 10).filter((hit) => {
      if (existsSync(hit.filePath)) return true
      if (existsSync(dirname(hit.filePath))) this.searchIndex.removeFile(hit.filePath)
      return false
    })

    // Pre-filter by file type if intent specifies one
    let filtered = candidates.map((kr) => {
      const fileName = basename(kr.filePath)
      return {
        filePath: kr.filePath,
        fileName,
        category: this.classifier.classify(fileName).category,
        subcategory: null,
        snippet: kr.snippet,
        score: Math.abs(kr.rank),
        source: 'keyword' as const
      }
    })

    if (intent.category) {
      const typeFiltered = filtered.filter((r) => r.category === intent.category)
      if (typeFiltered.length > 0) filtered = typeFiltered
    }

    // Score by keyword relevance
    const keywordResults = filtered
      .sort((a, b) => this.basicScore(query, b) - this.basicScore(query, a))
      .slice(0, limit)

    return keywordResults
  }

  /** Rule-based intent parsing — no LLM needed */
  private parseIntent(query: string): SearchIntent {
    const words = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 1)

    // Detect category from keywords
    let category: string | null = null
    for (const [cat, patterns] of Object.entries(CATEGORY_KEYWORDS)) {
      if (words.some((w) => patterns.includes(w))) {
        category = cat
        break
      }
    }

    // Remove stop words to get meaningful keywords
    const keywords = words.filter((w) => !STOP_WORDS.has(w))

    return { keywords, category }
  }

  private basicScore(query: string, result: SearchResult): number {
    const words = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 1)
    const fileName = result.fileName.toLowerCase()
    let score = 0
    for (const word of words) {
      if (fileName.includes(word)) score += 50
    }
    if (words.every((w) => fileName.includes(w))) score += 100
    return score
  }
}
