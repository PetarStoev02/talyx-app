export interface SearchResult {
  filePath: string
  fileName: string
  category: string
  subcategory: string | null
  snippet: string
  score: number
  source: 'keyword' | 'semantic' | 'both'
}

export interface SearchStats {
  indexedFiles: number
  totalEmbeddings: number
  lastIndexedAt: string | null
}
