import { describe, it, expect } from 'vitest'
import { RenameEngine } from '../../../src/main/domain/sorting/services/RenameEngine'
import type { SemanticResult } from '../../../src/main/domain/classification/model/SemanticResult'

describe('RenameEngine', () => {
  const engine = new RenameEngine()

  const makeResult = (overrides: Partial<SemanticResult> = {}): SemanticResult => ({
    semanticPath: ['Finance', 'Taxes'],
    suggestedName: null,
    entities: {
      dates: ['2024-03-15'],
      names: ['John Smith'],
      amounts: ['$1,250'],
      organizations: [],
      locations: []
    },
    confidence: 0.8,
    ...overrides
  })

  it('suggests rename for generic filename like scan_001.pdf', () => {
    const result = engine.suggest('scan_001.pdf', makeResult())
    expect(result).not.toBeNull()
    expect(result).toContain('2024-Q1')
    expect(result).toContain('Taxes')
    expect(result!.endsWith('.pdf')).toBe(true)
  })

  it('suggests rename for IMG_ prefix files', () => {
    const result = engine.suggest('IMG_20240901_142355.pdf', makeResult())
    expect(result).not.toBeNull()
    expect(result!.endsWith('.pdf')).toBe(true)
  })

  it('suggests rename for Document (N) pattern', () => {
    const result = engine.suggest('Document (3).docx', makeResult())
    expect(result).not.toBeNull()
    expect(result!.endsWith('.docx')).toBe(true)
  })

  it('suggests rename for download files', () => {
    const result = engine.suggest('download.pdf', makeResult())
    expect(result).not.toBeNull()
  })

  it('suggests rename for untitled files', () => {
    const result = engine.suggest('untitled.txt', makeResult())
    expect(result).not.toBeNull()
  })

  it('does NOT rename already descriptive filenames', () => {
    const result = engine.suggest('2024-Tax-Return-Final.pdf', makeResult())
    expect(result).toBeNull()
  })

  it('does NOT rename filenames with meaningful words', () => {
    const result = engine.suggest('quarterly-financial-report.pdf', makeResult())
    expect(result).toBeNull()
  })

  it('sanitizes special characters from suggested name', () => {
    const result = engine.suggest(
      'scan.pdf',
      makeResult({
        entities: {
          dates: [],
          names: ["O'Brien & Co."],
          amounts: [],
          organizations: [],
          locations: []
        }
      })
    )
    if (result) {
      expect(result).not.toMatch(/[&']/)
    }
  })

  it('caps filename length at 80 characters + extension', () => {
    const result = engine.suggest(
      'download.pdf',
      makeResult({
        semanticPath: ['Finance', 'Very-Long-Category-Name'],
        entities: {
          dates: ['2024-01-01'],
          names: ['Very Long Name Here That Goes On And On Forever And Ever'],
          amounts: [],
          organizations: ['Some Very Long Organization Name Inc'],
          locations: []
        }
      })
    )
    if (result) {
      const nameWithoutExt = result.replace('.pdf', '')
      expect(nameWithoutExt.length).toBeLessThanOrEqual(80)
    }
  })

  it('returns null when no semantic result provided', () => {
    const result = engine.suggest('scan.pdf', null as unknown as SemanticResult)
    expect(result).toBeNull()
  })

  it('handles semantic result with no entities gracefully', () => {
    const result = engine.suggest(
      'scan.pdf',
      makeResult({
        entities: { dates: [], names: [], amounts: [], organizations: [], locations: [] },
        semanticPath: ['Finance', 'Taxes']
      })
    )
    // Should still produce a name from the category
    expect(result).not.toBeNull()
    expect(result).toContain('Taxes')
  })

  // --- New smart naming tests ---

  it('formats ISO dates as quarter in date-first pattern', () => {
    const result = engine.suggest(
      'scan.pdf',
      makeResult({
        entities: {
          dates: ['2024-10-05'],
          names: [],
          amounts: [],
          organizations: [],
          locations: []
        }
      })
    )
    expect(result).not.toBeNull()
    expect(result).toContain('2024-Q4')
  })

  it('includes monetary amount in the filename', () => {
    const result = engine.suggest(
      'download.pdf',
      makeResult({
        entities: {
          dates: ['2024-06-01'],
          names: [],
          amounts: ['$42.50'],
          organizations: [],
          locations: []
        }
      })
    )
    expect(result).not.toBeNull()
    expect(result).toContain('42.50')
    // Currency symbol should be stripped
    expect(result).not.toContain('$')
  })

  it('uses organization as entity when no person name', () => {
    const result = engine.suggest(
      'scan.pdf',
      makeResult({
        entities: {
          dates: ['2024-01-15'],
          names: [],
          amounts: [],
          organizations: ['Acme Corp'],
          locations: []
        }
      })
    )
    expect(result).not.toBeNull()
    expect(result).toContain('Acme-Corp')
  })

  it('uses location as entity when no name or org', () => {
    const result = engine.suggest(
      'scan.pdf',
      makeResult({
        entities: {
          dates: [],
          names: [],
          amounts: [],
          organizations: [],
          locations: ['New York']
        }
      })
    )
    expect(result).not.toBeNull()
    expect(result).toContain('New-York')
  })

  it('produces smart name like 2024-Q4-Tax-Return-John-Smith', () => {
    const result = engine.suggest(
      'scan_001.pdf',
      makeResult({
        semanticPath: ['Finance', 'Tax-Return'],
        entities: {
          dates: ['2024-12-15'],
          names: ['John Smith'],
          amounts: [],
          organizations: [],
          locations: []
        }
      })
    )
    expect(result).not.toBeNull()
    expect(result).toBe('2024-Q4-Tax-Return-John-Smith.pdf')
  })

  it('produces smart name with amount like Receipt-Walmart-42.50', () => {
    const result = engine.suggest(
      'IMG_20240115.jpg',
      makeResult({
        semanticPath: ['Finance', 'Receipt'],
        entities: {
          dates: ['2024-01-15'],
          names: [],
          amounts: ['$42.50'],
          organizations: ['Walmart'],
          locations: []
        }
      })
    )
    expect(result).not.toBeNull()
    expect(result).toContain('Receipt')
    expect(result).toContain('Walmart')
    expect(result).toContain('42.50')
  })

  it('preserves non-ISO date formats as-is', () => {
    const result = engine.suggest(
      'scan.pdf',
      makeResult({
        entities: {
          dates: ['15/03/2024'],
          names: [],
          amounts: [],
          organizations: [],
          locations: []
        }
      })
    )
    expect(result).not.toBeNull()
    expect(result).toContain('15-03-2024')
  })

  it('strips commas and currency symbols from amounts', () => {
    const result = engine.suggest(
      'download.pdf',
      makeResult({
        entities: {
          dates: [],
          names: [],
          amounts: ['€1,234.56'],
          organizations: [],
          locations: []
        }
      })
    )
    expect(result).not.toBeNull()
    expect(result).not.toContain('€')
    expect(result).not.toContain(',')
    expect(result).toContain('1234.56')
  })
})
