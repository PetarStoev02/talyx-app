import { describe, it, expect } from 'vitest'
import {
  UserSettingsPartialSchema,
  absolutePath
} from '../../../src/main/infrastructure/ipc/validation'

describe('claudeCodePath setting', () => {
  it.each([
    ['/opt/homebrew/bin/claude', true],
    ['/opt/homebrew/bin/', true],
    [null, true],
    ['claude', false],
    ['../../bin/sh', false],
    ['', false]
  ])('should judge %s as valid: %s', (claudeCodePath, valid) => {
    expect(UserSettingsPartialSchema.safeParse({ claudeCodePath }).success).toBe(valid)
  })
})

describe('absolutePath', () => {
  it.each([
    ['/tmp/', true],
    ['/Users/x/Sorted', true],
    ['relative/dir', false],
    ['', false]
  ])('should judge %s as valid: %s', (path, valid) => {
    expect(absolutePath.safeParse(path).success).toBe(valid)
  })
})
