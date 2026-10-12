import { describe, it, expect } from 'vitest'
import {
  coerceToTaxonomy,
  isValidTaxonomyPath
} from '../../../src/main/domain/classification/model/Category'

describe('coerceToTaxonomy', () => {
  it('should keep a category and subcategory that are already valid', () => {
    expect(coerceToTaxonomy('Documents', 'Invoices')).toEqual({
      category: 'Documents',
      subcategory: 'Invoices'
    })
  })

  it('should rehome an invented category that names a real subcategory', () => {
    // The model's "Reports/analysis" is really Documents/Reports
    expect(coerceToTaxonomy('Reports', 'analysis')).toEqual({
      category: 'Documents',
      subcategory: 'Reports'
    })
  })

  it('should fall back to Other for an invented category with no known subcategory', () => {
    expect(coerceToTaxonomy('Financial', 'Tax Documents')).toEqual({
      category: 'Other',
      subcategory: 'Other'
    })
  })

  it('should replace an invented subcategory with Other inside a valid category', () => {
    expect(coerceToTaxonomy('Audio', 'Symphonies')).toEqual({
      category: 'Audio',
      subcategory: 'Other'
    })
  })

  it('should match a singular form of a real subcategory', () => {
    expect(coerceToTaxonomy('Videos', 'Clip')).toEqual({
      category: 'Videos',
      subcategory: 'Clips'
    })
    expect(coerceToTaxonomy('Audio', 'Recording')).toEqual({
      category: 'Audio',
      subcategory: 'Recordings'
    })
  })

  it('should match categories and subcategories regardless of case', () => {
    expect(coerceToTaxonomy('documents', 'invoices')).toEqual({
      category: 'Documents',
      subcategory: 'Invoices'
    })
  })

  it('should preserve a null subcategory on a valid category', () => {
    expect(coerceToTaxonomy('Images', null)).toEqual({
      category: 'Images',
      subcategory: null
    })
  })

  it('should fall back to Other when the category is empty', () => {
    expect(coerceToTaxonomy('', null)).toEqual({ category: 'Other', subcategory: null })
  })

  it('should not treat a duplicated category name as a subcategory rehome', () => {
    // "Documents/Documents" — a real observed miss
    expect(coerceToTaxonomy('Documents', 'Documents')).toEqual({
      category: 'Documents',
      subcategory: 'Other'
    })
  })
})

describe('isValidTaxonomyPath', () => {
  it('should accept a subcategory that belongs to its category', () => {
    expect(isValidTaxonomyPath('Documents', 'Invoices')).toBe(true)
  })

  it('should accept a category with no subcategory', () => {
    expect(isValidTaxonomyPath('Documents', null)).toBe(true)
  })

  it('should reject a category outside the taxonomy', () => {
    expect(isValidTaxonomyPath('Financial', 'Tax Documents')).toBe(false)
  })

  it('should reject a subcategory that belongs to a different category', () => {
    expect(isValidTaxonomyPath('Audio', 'Invoices')).toBe(false)
  })

  it('should reject a subcategory that exists nowhere in the taxonomy', () => {
    expect(isValidTaxonomyPath('Audio', 'Symphonies')).toBe(false)
  })
})
