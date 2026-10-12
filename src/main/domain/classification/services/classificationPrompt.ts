import log from 'electron-log'
import { coerceToTaxonomy } from '../model/Category'
import type { ExtractedEntities } from '../model/SemanticResult'

export interface CoordinatorResult {
  fileName: string
  category: string
  subcategory: string | null
  suggestedName: string | null
  confidence: number
}

export function parseCoordinatorResponse(raw: string): CoordinatorResult[] {
  try {
    let cleaned = raw.trim()
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    if (codeBlockMatch) {
      cleaned = codeBlockMatch[1].trim()
    }

    const parsed = JSON.parse(cleaned)

    if (!Array.isArray(parsed)) {
      log.warn('[classificationPrompt] Coordinator response is not an array')
      return []
    }

    return parsed.map((item: Record<string, unknown>) => {
      // The model invents paths under uncertainty — pin them to the real taxonomy
      // before they can become folders on disk
      const path = coerceToTaxonomy(
        String(item.category ?? 'Other'),
        item.subcategory ? String(item.subcategory) : null
      )
      return {
        fileName: String(item.fileName ?? ''),
        category: path.category,
        subcategory: path.subcategory,
        suggestedName: item.suggestedName
          ? normalizeSuggestedName(String(item.suggestedName))
          : null,
        confidence: typeof item.confidence === 'number' ? item.confidence : 0.5
      }
    })
  } catch {
    log.warn('[classificationPrompt] Failed to parse coordinator response:', raw.slice(0, 200))
    return []
  }
}

const MAX_SUGGESTED_NAME_LENGTH = 50

/**
 * The model ignores the naming format rules often enough that they are
 * enforced mechanically: whitespace becomes hyphens (the prompt's
 * descriptive-name_YYYYMMDD.ext convention) and overlong names are capped
 * preserving the extension.
 */
function normalizeSuggestedName(name: string): string {
  const hyphenated = name.trim().replace(/\s+/g, '-').replace(/-{2,}/g, '-')
  if (hyphenated.length <= MAX_SUGGESTED_NAME_LENGTH) return hyphenated

  const dotIndex = hyphenated.lastIndexOf('.')
  const extension = dotIndex > 0 ? hyphenated.slice(dotIndex) : ''
  const stem = dotIndex > 0 ? hyphenated.slice(0, dotIndex) : hyphenated
  return stem.slice(0, MAX_SUGGESTED_NAME_LENGTH - extension.length) + extension
}

/**
 * Match coordinator results to batch files by fileName. The model may return
 * results out of order, echo garbled names, or return fewer items than files —
 * positional mapping silently misassigns in all three cases.
 */
export function matchResultsByFileName(
  parsed: CoordinatorResult[],
  fileNames: string[]
): Map<number, CoordinatorResult> {
  const matched = new Map<number, CoordinatorResult>()
  const usedResults = new Set<number>()
  const norm = (s: string): string => s.normalize('NFC').trim().toLowerCase()

  // Pass 1: exact fileName match
  for (let i = 0; i < fileNames.length; i++) {
    const j = parsed.findIndex((p, idx) => !usedResults.has(idx) && p.fileName === fileNames[i])
    if (j !== -1) {
      matched.set(i, parsed[j])
      usedResults.add(j)
    }
  }

  // Pass 2: normalized match (case, unicode form, whitespace)
  for (let i = 0; i < fileNames.length; i++) {
    if (matched.has(i)) continue
    const target = norm(fileNames[i])
    const j = parsed.findIndex((p, idx) => !usedResults.has(idx) && norm(p.fileName) === target)
    if (j !== -1) {
      matched.set(i, parsed[j])
      usedResults.add(j)
    }
  }

  // Pass 3: positional fallback — only safe when counts line up exactly
  if (parsed.length === fileNames.length) {
    for (let i = 0; i < fileNames.length; i++) {
      if (matched.has(i)) continue
      if (!usedResults.has(i)) {
        matched.set(i, parsed[i])
        usedResults.add(i)
      }
    }
  }

  return matched
}

export interface PipelineProgress {
  phase: 'extracting' | 'classifying-ai' | 'done'
  completed: number
  total: number
  currentFile: string
}

/** As many matches per pattern as the prompt's size budget affords. */
const PROMPT_ENTITY_LIMIT = 3

/**
 * Exported for the preview path, which masks these before any text leaves the
 * machine. That path passes `Infinity`: a cap that exists to keep a local
 * prompt short becomes a leak when the same list decides what gets masked.
 */
export function extractEntitiesFromText(
  text: string | null,
  limit: number = PROMPT_ENTITY_LIMIT
): ExtractedEntities {
  const entities = {
    dates: [] as string[],
    names: [] as string[],
    amounts: [] as string[],
    organizations: [] as string[],
    locations: [] as string[]
  }
  if (!text) return entities

  // Dates: various formats
  const datePatterns = [
    /\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/g,
    /\d{4}[/.-]\d{1,2}[/.-]\d{1,2}/g,
    /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s*\d{4}/gi,
    /\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/gi,
    /\d{1,2}\s+(?:януари|февруари|март|април|май|юни|юли|август|септември|октомври|ноември|декември)\s+\d{4}/gi
  ]
  for (const pattern of datePatterns) {
    const matches = text.match(pattern)
    if (matches) entities.dates.push(...matches.slice(0, limit))
  }

  // Amounts: currency patterns
  const amountPatterns = [/[$€£¥]\s*[\d,]+\.?\d*/g, /[\d,]+\.?\d*\s*(?:USD|EUR|BGN|лв\.?|лева)/gi]
  for (const pattern of amountPatterns) {
    const matches = text.match(pattern)
    if (matches) entities.amounts.push(...matches.slice(0, limit))
  }

  // Organizations: common patterns (Ltd, Inc, LLC, OOD, EOOD, etc.)
  // \b is ASCII-only, so the Cyrillic suffixes need a Unicode-aware boundary.
  const orgPattern =
    /(?:[A-ZА-Я][a-zа-я]+\s+){0,3}(?:Ltd|Inc|LLC|Corp|GmbH|ООД|ЕООД|АД|ЕТ|СД)(?![\p{L}\p{N}])/gu
  const orgMatches = text.match(orgPattern)
  if (orgMatches) entities.organizations.push(...orgMatches.slice(0, limit))

  return entities
}
