import { describe, it, expect } from 'vitest'
import {
  validateInput,
  isPathContained,
  FileEntrySchema,
  SortExecuteParamsSchema,
  WatchAddParamsSchema,
  WatchToggleParamsSchema,
  UserSettingsPartialSchema,
  SortHistoryParamsSchema
} from '../../../src/main/infrastructure/ipc/validation'

describe('validateInput', () => {
  it('should throw on invalid input', () => {
    expect(() => validateInput(FileEntrySchema, { name: '' })).toThrow()
  })
})

describe('isPathContained', () => {
  it('should return true when child is inside parent', () => {
    expect(isPathContained('/output/Documents/file.pdf', '/output')).toBe(true)
  })

  it('should return false when child escapes parent via ../', () => {
    expect(isPathContained('/output/../etc/passwd', '/output')).toBe(false)
  })

  it('should return false when child equals parent', () => {
    expect(isPathContained('/output', '/output')).toBe(false)
  })

  it('should return false for sibling directories', () => {
    expect(isPathContained('/other/file.pdf', '/output')).toBe(false)
  })
})

describe('FileEntrySchema', () => {
  it('should accept valid file entry', () => {
    const result = FileEntrySchema.parse({
      name: 'test.pdf',
      path: '/Users/test/file.pdf',
      extension: '.pdf',
      size: 1024
    })
    expect(result.name).toBe('test.pdf')
  })

  it('should reject empty name', () => {
    expect(() =>
      FileEntrySchema.parse({
        name: '',
        path: '/test/file.pdf',
        extension: '.pdf',
        size: 1024
      })
    ).toThrow()
  })

  it('should reject relative paths', () => {
    expect(() =>
      FileEntrySchema.parse({
        name: 'file.pdf',
        path: './relative/file.pdf',
        extension: '.pdf',
        size: 1024
      })
    ).toThrow()
  })

  it('should reject negative size', () => {
    expect(() =>
      FileEntrySchema.parse({
        name: 'file.pdf',
        path: '/test/file.pdf',
        extension: '.pdf',
        size: -1
      })
    ).toThrow()
  })
})

describe('SortExecuteParamsSchema', () => {
  it('should accept valid sort execute params', () => {
    const result = SortExecuteParamsSchema.parse({
      files: [
        {
          path: '/src/file.pdf',
          name: 'file.pdf',
          size: 1024,
          classification: {
            category: 'Documents',
            subcategory: null,
            confidence: 0.95,
            metadata: {}
          }
        }
      ],
      outputDir: '/output',
      mode: 'copy'
    })
    expect(result.mode).toBe('copy')
  })

  it('should reject invalid sort mode', () => {
    expect(() =>
      SortExecuteParamsSchema.parse({
        files: [],
        outputDir: '/output',
        mode: 'delete'
      })
    ).toThrow()
  })
})

describe('WatchAddParamsSchema', () => {
  it('should accept valid params', () => {
    const result = WatchAddParamsSchema.parse({
      path: '/watch/folder',
      outputPath: '/output/folder',
      sortMode: 'copy'
    })
    expect(result.sortMode).toBe('copy')
  })

  it('should reject relative paths', () => {
    expect(() =>
      WatchAddParamsSchema.parse({
        path: 'relative/path',
        outputPath: '/output',
        sortMode: 'copy'
      })
    ).toThrow()
  })
})

describe('WatchToggleParamsSchema', () => {
  it('should accept valid toggle params', () => {
    const result = WatchToggleParamsSchema.parse({ id: 1, enabled: true })
    expect(result.enabled).toBe(true)
  })

  it('should reject non-positive id', () => {
    expect(() => WatchToggleParamsSchema.parse({ id: 0, enabled: true })).toThrow()
  })
})

describe('SortHistoryParamsSchema', () => {
  it('should accept valid params', () => {
    const result = SortHistoryParamsSchema.parse({ limit: 50, offset: 0 })
    expect(result.limit).toBe(50)
  })

  it('should reject limit > 1000', () => {
    expect(() => SortHistoryParamsSchema.parse({ limit: 1001, offset: 0 })).toThrow()
  })
})

describe('UserSettingsPartialSchema', () => {
  it('should accept valid partial settings', () => {
    const result = UserSettingsPartialSchema.parse({
      theme: 'dark',
      defaultSortMode: 'move'
    })
    expect(result.theme).toBe('dark')
  })

  it('should accept empty object', () => {
    const result = UserSettingsPartialSchema.parse({})
    expect(result).toEqual({})
  })

  it('should reject invalid theme', () => {
    expect(() => UserSettingsPartialSchema.parse({ theme: 'blue' })).toThrow()
  })

  it('should reject classification rules with empty extension', () => {
    expect(() =>
      UserSettingsPartialSchema.parse({
        classificationRules: [{ extension: '', category: 'Test', subcategory: null }]
      })
    ).toThrow()
  })

  it('should accept the assistant provider and Claude Code path', () => {
    expect(
      UserSettingsPartialSchema.parse({
        assistantProvider: 'claude-code',
        claudeCodePath: '/opt/homebrew/bin/claude'
      })
    ).toEqual({ assistantProvider: 'claude-code', claudeCodePath: '/opt/homebrew/bin/claude' })
    expect(UserSettingsPartialSchema.parse({ claudeCodePath: null })).toEqual({
      claudeCodePath: null
    })
    expect(() => UserSettingsPartialSchema.parse({ assistantProvider: 'gpt' })).toThrow()
  })
})
