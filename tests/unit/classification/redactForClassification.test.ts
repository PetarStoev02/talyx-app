import { describe, it, expect } from 'vitest'
import {
  redactForClassification,
  CLASSIFY_TEXT_BUDGET
} from '../../../src/main/domain/classification/services/redactForClassification'

const none = { dates: [], names: [], amounts: [], organizations: [], locations: [] }

describe('redactForClassification', () => {
  it('should mask a name the extractor found', () => {
    const out = redactForClassification('Invoice for Petar Stoev, due soon', {
      ...none,
      names: ['Petar Stoev']
    })
    expect(out).toBe('Invoice for [PERSON], due soon')
    expect(out).not.toContain('Petar')
  })

  it('should mask every occurrence, not just the first', () => {
    const out = redactForClassification('Petar and Petar again', { ...none, names: ['Petar'] })
    expect(out).toBe('[PERSON] and [PERSON] again')
  })

  it('should mask an amount and keep the surrounding words', () => {
    const out = redactForClassification('Total 1200.00 EUR payable', {
      ...none,
      amounts: ['1200.00 EUR']
    })
    expect(out).toBe('Total [AMOUNT] payable')
  })

  it('should leave text with no entities unchanged', () => {
    expect(redactForClassification('A quarterly report', none)).toBe('A quarterly report')
  })

  it('should cut text to the budget', () => {
    const long = 'x'.repeat(CLASSIFY_TEXT_BUDGET + 500)
    expect(redactForClassification(long, none)).toHaveLength(CLASSIFY_TEXT_BUDGET)
  })

  it('should mask before cutting, so a masked entity cannot survive the cut', () => {
    const padding = 'y'.repeat(CLASSIFY_TEXT_BUDGET - 5)
    const out = redactForClassification(`${padding} Petar Stoev`, {
      ...none,
      names: ['Petar Stoev']
    })
    expect(out).not.toContain('Petar')
  })

  it('should ignore an empty entity string rather than masking everything', () => {
    expect(redactForClassification('anything', { ...none, names: [''] })).toBe('anything')
  })

  it('should mask the longest entity first when one contains another', () => {
    const out = redactForClassification('Acme Holdings Ltd invoice', {
      ...none,
      organizations: ['Acme', 'Acme Holdings Ltd']
    })
    expect(out).toBe('[ORG] invoice')
  })

  it('should merge overlapping spans when earlier span is shorter', () => {
    const out = redactForClassification('Anna Petrova Katrina works here', {
      ...none,
      names: ['Anna Petrova', 'Petrova Katrina']
    })
    expect(out).not.toContain('Katrina')
    expect(out).not.toContain('Anna')
    expect(out).not.toContain('Petrova')
  })

  it('should merge cross-category overlaps completely', () => {
    const out = redactForClassification('Stoev Enterprises Petar signed', {
      ...none,
      names: ['Enterprises Petar'],
      organizations: ['Stoev Enterprises']
    })
    expect(out).not.toContain('Petar')
    expect(out).not.toContain('Stoev')
    expect(out).not.toContain('Enterprises')
  })

  it('should label a merged mixed-category region with the leftmost span mask', () => {
    const out = redactForClassification('Stoev Enterprises Petar signed', {
      ...none,
      names: ['Enterprises Petar'],
      organizations: ['Stoev Enterprises']
    })
    expect(out).toBe('[ORG] signed')
  })

  it('should keep adjacent non-overlapping entities as separate masks', () => {
    const out = redactForClassification('Invoice from Acme Corp', {
      ...none,
      organizations: ['Acme', 'Corp']
    })
    expect(out).toBe('Invoice from [ORG] [ORG]')
  })
})
