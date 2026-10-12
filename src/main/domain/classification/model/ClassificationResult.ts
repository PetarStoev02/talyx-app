import type { Category } from './Category'
import type { ExtractedEntities } from './SemanticResult'

export interface ClassificationResult {
  category: Category
  subcategory: string | null
  confidence: number
  metadata: Record<string, unknown>
}

export interface EnhancedClassificationResult extends ClassificationResult {
  semanticPath?: string[]
  suggestedName?: string | null
  entities?: ExtractedEntities
}
