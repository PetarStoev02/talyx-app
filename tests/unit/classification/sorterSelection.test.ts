import { describe, it, expect, vi } from 'vitest'
import { SmartLocalSorter } from '../../../src/main/domain/classification/services/Sorter'
import type { ModelProvider } from '../../../src/main/domain/agent/ModelProvider'
import {
  findOwnersClaude,
  resolveSorter,
  type SorterChoice
} from '../../../src/main/infrastructure/ipc/resolveSorter'
import type { ClaudeCodeProviderOptions } from '../../../src/main/infrastructure/ai-providers/ClaudeCodeProvider'
import type { UserSettings } from '../../../src/main/infrastructure/storage/SettingsStore'

describe('SmartLocalSorter', () => {
  it('should still add no verdicts when given files with text', async () => {
    const sorter = new SmartLocalSorter()
    const verdicts = await sorter.classify(
      [
        {
          path: '/tmp/a.pdf',
          name: 'a.pdf',
          size: 10,
          extensionHint: 'Documents',
          extractedText: 'an invoice',
          entities: { dates: [], names: [], amounts: [], organizations: [], locations: [] }
        }
      ],
      'en'
    )
    expect(verdicts).toEqual([])
  })
})

describe('resolveSorter', () => {
  const claude = {
    provider: { complete: vi.fn() } as unknown as ModelProvider,
    modelId: 'claude-opus-5'
  }

  function choice(overrides: Partial<SorterChoice>): SorterChoice {
    return {
      source: 'smart-local',
      claude: null,
      ...overrides
    }
  }

  it('should send nothing anywhere when the owner picked Smart Local', () => {
    const sorter = resolveSorter(choice({ source: 'smart-local', claude }))
    expect(sorter.id).toBe('smart-local')
  })

  it('should sort with the owner’s own Claude when they picked it', () => {
    const sorter = resolveSorter(choice({ source: 'claude', claude }))
    expect(sorter.id).toBe('claude')
    expect(sorter.engineVersion).toBe('claude:claude-opus-5')
  })

  it('should stay local when the owner picked Claude but theirs is unreachable', () => {
    const sorter = resolveSorter(choice({ source: 'claude', claude: null }))
    expect(sorter.id).toBe('smart-local')
  })
})

describe('findOwnersClaude', () => {
  /** An existing file, so `findInstalledClaudeCode` answers the same on every machine. */
  const installedBinary = process.execPath

  function settings(assistantModel: string): UserSettings {
    return {
      assistantProvider: 'claude-code',
      claudeCodePath: installedBinary,
      assistantModel
    } as UserSettings
  }

  /** What the provider will actually hand the CLI — `undefined` means "your default". */
  function modelReachingTheCli(provider: ModelProvider): string | undefined {
    return (provider as unknown as { options: ClaudeCodeProviderOptions }).options.model
  }

  it('should send a default install to the CLI default instead of an API-key id', () => {
    const owners = findOwnersClaude({ settings: settings('claude-opus-5'), apiKey: null })
    expect(owners?.modelId).toBe('default')
    expect(modelReachingTheCli(owners!.provider)).toBeUndefined()
  })

  it('should keep a model the owner picked from their own CLI', () => {
    const owners = findOwnersClaude({ settings: settings('sonnet[1m]'), apiKey: null })
    expect(owners?.modelId).toBe('sonnet[1m]')
    expect(modelReachingTheCli(owners!.provider)).toBe('sonnet[1m]')
  })

  it('should turn the CLI\'s own "Default" row into no model at all', () => {
    const owners = findOwnersClaude({ settings: settings('default'), apiKey: null })
    expect(owners?.modelId).toBe('default')
    expect(modelReachingTheCli(owners!.provider)).toBeUndefined()
  })
})
