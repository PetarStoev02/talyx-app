import { homedir } from 'os'
import type { ModelProvider } from '../../domain/agent/ModelProvider'
import { ClaudeSorter } from '../../domain/classification/services/ClaudeSorter'
import { SmartLocalSorter, type Sorter } from '../../domain/classification/services/Sorter'
import { AnthropicProvider, API_KEY_MODELS, isApiKeyModel } from '../ai-providers/AnthropicProvider'
import { ClaudeCodeProvider } from '../ai-providers/ClaudeCodeProvider'
import { CLI_DEFAULT_MODEL, toCliModel } from '../brains/ClaudeCodeBrain'
import { findInstalledClaudeCode } from '../brains/findClaudeCode'
import type { UserSettings } from '../storage/SettingsStore'

/** The owner's own Claude, ready to answer. */
export interface OwnersClaude {
  provider: ModelProvider
  modelId: string
}

export interface SorterChoice {
  /** What the owner picked in Settings. Nothing else may override it. */
  source: UserSettings['sorterSource']
  /** Null when their Claude is unreachable — no key, or no installed binary. */
  claude: OwnersClaude | null
}

/**
 * Which sorter reads the owner's files. Pure selection: it opens nothing and
 * asks nothing, so a wrong answer here is visible in a test and not only in a
 * network log. Anything unavailable falls back to Smart Local, which sends
 * nothing anywhere.
 */
export function resolveSorter(choice: SorterChoice): Sorter {
  if (choice.source === 'claude' && choice.claude) {
    return new ClaudeSorter(choice.claude.provider, choice.claude.modelId)
  }
  return new SmartLocalSorter()
}

const CLASSIFIER_PROMPT =
  'You classify files into a fixed taxonomy. Answer with JSON only, no explanation.'

/**
 * The same account the assistant uses — their API key, or their signed-in
 * Claude Code — asked for at most once per sort. Null means their Claude
 * cannot be reached, and the caller falls back rather than failing the sort.
 */
export function findOwnersClaude(deps: {
  settings: UserSettings
  /** Null when no key is stored, or when it could not be decrypted. */
  apiKey: string | null
}): OwnersClaude | null {
  const { settings, apiKey } = deps
  if (settings.assistantProvider === 'claude-code') {
    const claudeCodePath = findInstalledClaudeCode(settings.claudeCodePath, homedir())
    if (!claudeCodePath) return null
    // Symmetrical with the API-key branch below: an id left over from the other
    // brain must not reach the CLI either. `agent.ipc`'s `claudeCodeModel` vets
    // the stored id against the catalog that binary reported, but reading that
    // catalog means spawning the CLI and this function opens nothing — so an id
    // we cannot vouch for degrades to the CLI's own default rather than failing
    // the query. `toCliModel` then turns that default into "no model at all",
    // while the cache key keeps saying `default` so a later pick is a new key.
    const modelId = isApiKeyModel(settings.assistantModel)
      ? CLI_DEFAULT_MODEL
      : settings.assistantModel
    return {
      provider: new ClaudeCodeProvider({
        claudeCodePath,
        model: toCliModel(modelId)
      }),
      modelId
    }
  }
  if (!apiKey) return null
  // An id left over from the other brain must not reach the Messages API.
  const modelId = isApiKeyModel(settings.assistantModel)
    ? settings.assistantModel
    : API_KEY_MODELS[0].id
  return {
    provider: new AnthropicProvider(
      apiKey,
      () => modelId,
      () => CLASSIFIER_PROMPT
    ),
    modelId
  }
}
