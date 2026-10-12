import { extname, basename } from 'path'
import type { SemanticResult, ExtractedEntities } from '../../classification/model/SemanticResult'

const MAX_NAME_LENGTH = 80

export class RenameEngine {
  suggest(fileName: string, semanticResult: SemanticResult | null): string | null {
    if (!semanticResult) return null

    const ext = extname(fileName)
    const nameWithoutExt = basename(fileName, ext)

    // Only rename generic/non-descriptive filenames
    if (!this.isGenericFilename(nameWithoutExt)) return null

    const parts = this.buildNameParts(semanticResult)
    if (parts.length === 0) return null

    const joined = parts.join('-')
    const sanitized = this.sanitize(joined)
    const truncated = sanitized.slice(0, MAX_NAME_LENGTH)
    // Remove trailing hyphen after truncation
    const cleaned = truncated.replace(/-$/, '')
    const suggested = cleaned + ext

    // Skip if the suggestion is essentially the same as the original
    if (this.sanitize(nameWithoutExt).toLowerCase() === cleaned.toLowerCase()) {
      return null
    }

    return suggested
  }

  private buildNameParts(result: SemanticResult): string[] {
    const e = result.entities
    const date = this.formatDate(e.dates[0] ?? null)
    const type = result.semanticPath[result.semanticPath.length - 1] || null
    const entity = this.pickEntity(e)
    const amount = this.formatAmount(e.amounts[0] ?? null)

    // Use today's date as fallback when no date found in entities
    const dateOrToday = date ?? new Date().toISOString().split('T')[0].replace(/-/g, '')

    // Build a rich name with the most descriptive parts available
    const parts = [date, type, entity, amount].filter(Boolean) as string[]

    // If only the type is available, add today's date for uniqueness
    if (parts.length === 1 && parts[0] === type) {
      parts.push(dateOrToday)
    }

    return parts
  }

  /**
   * Pick the best entity identifier: prefer person name, then org, then location.
   */
  private pickEntity(e: ExtractedEntities): string | null {
    return e.names[0] || e.organizations[0] || e.locations[0] || null
  }

  /**
   * Format a date for use in a filename.
   * Converts YYYY-MM-DD to include quarter info when possible.
   */
  private formatDate(date: string | null): string | null {
    if (!date) return null

    const isoMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (isoMatch) {
      const [, year, month] = isoMatch
      const q = Math.ceil(parseInt(month, 10) / 3)
      return `${year}-Q${q}`
    }

    return date
  }

  /**
   * Format a monetary amount for use in a filename.
   * Strips the currency symbol and commas to produce a clean number.
   */
  private formatAmount(amount: string | null): string | null {
    if (!amount) return null
    return amount.replace(/[$€£,]/g, '')
  }

  private isGenericFilename(name: string): boolean {
    // Match common auto-generated / non-descriptive filenames
    const genericPatterns = [
      /^scan/i,
      /^img[_\s-]/i,
      /^dsc[_\s-]/i,
      /^photo[_\s-]/i,
      /^image[_\s-]?\d/i,
      /^document[_\s-]?\d/i,
      /^download/i,
      /^untitled/i,
      /^new\s*(file|document|doc)/i,
      /^copy\s*(of)?/i,
      /^file[_\s-]?\d/i,
      /^video[_\s-]?\d/i,
      /^audio[_\s-]?\d/i,
      /^music[_\s-]?\d/i,
      /^spreadsheet[_\s-]?\d/i,
      /^presentation[_\s-]?\d/i,
      /^model3d[_\s-]?\d/i,
      /^vector[_\s-]?\d/i,
      /^design[_\s-]?\d/i,
      /^code[_\s-]?\d/i,
      /^other[_\s-]?\d/i,
      /^archive[_\s-]?\d/i,
      /^data[_\s-]?\d/i,
      /^screenshot[_\s-]?\d/i,
      /^recording[_\s-]?\d/i,
      /^capture[_\s-]?\d/i,
      /^\d{8}[_\s]/i,
      /^[A-Z]{2,4}[_\s]\d{4,}/i,
      /^pexels-/i,
      /^unsplash-/i,
      /^shutterstock[_-]/i,
      /^\d+_\d+_\d+_\d+fps/i
    ]
    if (genericPatterns.some((p) => p.test(name))) return true

    // Strip dates and numbers, then check if remaining tokens are meaningful
    const lower = name.toLowerCase()
    const stripped = lower.replace(/\d{4}[-_]?\d{2}[-_]?\d{2}/g, '').replace(/\d+/g, '')
    const tokens = stripped.split(/[\s_\-.,()]+/).filter((t) => t.length > 1)
    // If very few meaningful tokens remain, it's generic
    return tokens.length < 2
  }

  private sanitize(name: string): string {
    return name
      .replace(/[^\p{L}\p{N}\-_.]/gu, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '')
  }
}
