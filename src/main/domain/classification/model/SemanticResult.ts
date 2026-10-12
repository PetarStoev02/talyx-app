export interface ExtractedEntities {
  dates: string[]
  names: string[]
  amounts: string[]
  organizations: string[]
  locations: string[]
}

export interface SemanticResult {
  semanticPath: string[]
  suggestedName: string | null
  entities: ExtractedEntities
  confidence: number
}
