import { describe, it, expect } from 'vitest'
import { TAXONOMY } from '../../../src/renderer/src/shared/lib/taxonomy'
import { CATEGORIES, SUBCATEGORIES } from '../../../src/main/domain/classification/model/Category'

describe('correction dialog taxonomy', () => {
  it('should offer every category the classifier can produce', () => {
    expect(Object.keys(TAXONOMY).sort()).toEqual([...CATEGORIES].sort())
  })

  it.each([...CATEGORIES])(
    'should offer every %s subcategory the correction IPC accepts',
    (category) => {
      expect([...TAXONOMY[category]].sort()).toEqual([...SUBCATEGORIES[category]].sort())
    }
  )
})
