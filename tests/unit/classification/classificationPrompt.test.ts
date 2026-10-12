import { describe, it, expect } from 'vitest'
import {
  extractEntitiesFromText,
  parseCoordinatorResponse,
  matchResultsByFileName,
  type CoordinatorResult
} from '../../../src/main/domain/classification/services/classificationPrompt'

describe('classificationPrompt', () => {
  describe('parseCoordinatorResponse', () => {
    it('should parse valid JSON array response', () => {
      const raw = `[{"fileName":"scan.pdf","category":"Documents","subcategory":"Invoices","suggestedName":"acme-invoice_20260315.pdf","confidence":0.95}]`
      const results = parseCoordinatorResponse(raw)
      expect(results).toHaveLength(1)
      expect(results[0].category).toBe('Documents')
      expect(results[0].subcategory).toBe('Invoices')
      expect(results[0].confidence).toBe(0.95)
    })

    it('should handle malformed JSON gracefully', () => {
      const results = parseCoordinatorResponse('this is not json')
      expect(results).toEqual([])
    })

    it('should extract JSON from markdown code blocks', () => {
      const raw =
        '```json\n[{"fileName":"test.pdf","category":"Documents","subcategory":"Reports","suggestedName":"test","confidence":0.8}]\n```'
      const results = parseCoordinatorResponse(raw)
      expect(results).toHaveLength(1)
      expect(results[0].category).toBe('Documents')
    })

    it('should rehome an invented category into the real taxonomy', () => {
      const raw = `[{"fileName":"q1.txt","category":"Reports","subcategory":"analysis","suggestedName":null,"confidence":0.9}]`
      const results = parseCoordinatorResponse(raw)
      expect(results[0].category).toBe('Documents')
      expect(results[0].subcategory).toBe('Reports')
    })

    it('should replace an invented subcategory with Other', () => {
      const raw = `[{"fileName":"ep.mp3","category":"Audio","subcategory":"Symphonies","suggestedName":null,"confidence":0.9}]`
      const results = parseCoordinatorResponse(raw)
      expect(results[0].category).toBe('Audio')
      expect(results[0].subcategory).toBe('Other')
    })

    it('should normalize a suggested name with spaces into hyphenated form', () => {
      const raw = `[{"fileName":"notes.txt","category":"Documents","subcategory":"Reports","suggestedName":"Q3 2026 Business Review_20260901.txt","confidence":0.9}]`
      const results = parseCoordinatorResponse(raw)
      expect(results[0].suggestedName).toBe('Q3-2026-Business-Review_20260901.txt')
    })

    it('should cap an overlong suggested name at 50 chars preserving the extension', () => {
      const longStem = 'a'.repeat(80)
      const raw = `[{"fileName":"x.txt","category":"Documents","subcategory":"Other","suggestedName":"${longStem}.txt","confidence":0.9}]`
      const results = parseCoordinatorResponse(raw)
      expect(results[0].suggestedName).toHaveLength(50)
      expect(results[0].suggestedName?.endsWith('.txt')).toBe(true)
    })

    it('should fall back to Other for a category outside the taxonomy', () => {
      const raw = `[{"fileName":"x.pdf","category":"Financial","subcategory":"Tax Documents","suggestedName":null,"confidence":0.9}]`
      const results = parseCoordinatorResponse(raw)
      expect(results[0].category).toBe('Other')
      expect(results[0].subcategory).toBe('Other')
    })
  })

  describe('matchResultsByFileName', () => {
    function result(fileName: string, category = 'Documents'): CoordinatorResult {
      return { fileName, category, subcategory: null, suggestedName: null, confidence: 0.9 }
    }

    it('should match results by fileName regardless of order', () => {
      const parsed = [result('b.pdf'), result('a.pdf')]
      const matched = matchResultsByFileName(parsed, ['a.pdf', 'b.pdf'])
      expect(matched.get(0)?.fileName).toBe('a.pdf')
      expect(matched.get(1)?.fileName).toBe('b.pdf')
    })

    it('should match case-insensitively when exact match fails', () => {
      const parsed = [result('Invoice.PDF')]
      const matched = matchResultsByFileName(parsed, ['invoice.pdf'])
      expect(matched.get(0)?.fileName).toBe('Invoice.PDF')
    })

    it('should match unicode-normalized Cyrillic names', () => {
      const decomposed = 'резюме.pdf'.normalize('NFD')
      const parsed = [result(decomposed)]
      const matched = matchResultsByFileName(parsed, ['резюме.pdf'.normalize('NFC')])
      expect(matched.get(0)).toBeDefined()
    })

    it('should fall back to positional mapping when counts match but names do not', () => {
      const parsed = [result('garbled-1'), result('garbled-2')]
      const matched = matchResultsByFileName(parsed, ['a.pdf', 'b.pdf'])
      expect(matched.get(0)?.fileName).toBe('garbled-1')
      expect(matched.get(1)?.fileName).toBe('garbled-2')
    })

    it('should leave files unmatched when the model returns fewer unknown names', () => {
      const parsed = [result('a.pdf')]
      const matched = matchResultsByFileName(parsed, ['a.pdf', 'b.pdf', 'c.pdf'])
      expect(matched.size).toBe(1)
      expect(matched.get(0)?.fileName).toBe('a.pdf')
      expect(matched.has(1)).toBe(false)
      expect(matched.has(2)).toBe(false)
    })

    it('should not reuse one result for two files', () => {
      const parsed = [result('a.pdf')]
      const matched = matchResultsByFileName(parsed, ['a.pdf', 'A.PDF'])
      expect(matched.size).toBe(1)
    })
  })

  describe('extractEntitiesFromText', () => {
    const fiveAmounts = 'Due $10.00 then $20.00 then $30.00 then $40.00 then $50.00'

    it('should keep the local prompt short by default', () => {
      expect(extractEntitiesFromText(fiveAmounts).amounts).toHaveLength(3)
    })

    it('should find every amount when the caller asks for no cap', () => {
      expect(extractEntitiesFromText(fiveAmounts, Infinity).amounts).toHaveLength(5)
    })

    it('should find no personal names or locations, whatever the cap', () => {
      const entities = extractEntitiesFromText('Petar Stoev, Sofia, Bulgaria', Infinity)
      expect(entities.names).toEqual([])
      expect(entities.locations).toEqual([])
    })

    it('should find a company ending in a Cyrillic legal suffix', () => {
      const { organizations } = extractEntitiesFromText('Договор с Фирма ЕООД')
      expect(organizations).toHaveLength(1)
      expect(organizations[0].endsWith('ЕООД')).toBe(true)
    })

    it('should still find a company ending in a Latin legal suffix', () => {
      expect(extractEntitiesFromText('Paid to Acme Ltd today').organizations).toEqual(['Acme Ltd'])
    })

    it('should not treat a suffix inside a longer word as a legal suffix', () => {
      expect(extractEntitiesFromText('Acme Ltdx').organizations).toEqual([])
      expect(extractEntitiesFromText('Фирма ЕООДх').organizations).toEqual([])
    })
  })
})
