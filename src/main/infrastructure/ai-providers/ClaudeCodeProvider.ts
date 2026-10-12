import { homedir } from 'os'
import { query as sdkQuery, type SDKResultMessage } from '@anthropic-ai/claude-agent-sdk'
import type {
  AssistantReply,
  ConversationMessage,
  ModelProvider,
  ToolDefinition
} from '../../domain/agent/ModelProvider'
import {
  AgentAbortedError,
  BrainFailedError,
  ClaudeCodeNotSignedInError
} from '../../domain/agent/errors'
import { isSignInFailure } from '../brains/ClaudeCodeBrain'

export type QueryFn = typeof sdkQuery

export interface ClaudeCodeProviderOptions {
  claudeCodePath: string
  /** Undefined means "whatever the CLI defaults to" — see `toCliModel`. */
  model: string | undefined
  /** Injected by tests; defaults to the SDK's query(). */
  runQuery?: QueryFn
}

/**
 * Claude Code as a plain text completer: one prompt in, one answer out, no
 * tools and no approval gate. Classification needs a model, not an agent.
 */
export class ClaudeCodeProvider implements ModelProvider {
  private readonly runQuery: QueryFn

  constructor(private readonly options: ClaudeCodeProviderOptions) {
    this.runQuery = options.runQuery ?? sdkQuery
  }

  async complete(
    messages: ConversationMessage[],
    _tools: ToolDefinition[],
    signal: AbortSignal
  ): Promise<AssistantReply> {
    // A signal that fired before this call ever started (e.g. a shared batch-abort
    // controller) must still stop us from spawning the process at all.
    if (signal.aborted) throw new AgentAbortedError()
    const controller = new AbortController()
    const forwardAbort = (): void => controller.abort()
    signal.addEventListener('abort', forwardAbort, { once: true })
    try {
      const stream = this.runQuery({
        // Owners who do not code have no project folder to spawn in — the
        // home directory always exists.
        prompt: messages.map((m) => ('text' in m ? m.text : '')).join('\n\n'),
        options: {
          cwd: homedir(),
          pathToClaudeCodeExecutable: this.options.claudeCodePath,
          model: this.options.model,
          // Unlike allowedTools (auto-approval only), an empty tools list is what
          // actually keeps this a plain completer instead of a tool-capable agent.
          tools: [],
          permissionMode: 'default',
          settingSources: [],
          abortController: controller
        }
      })
      const text: string[] = []
      for await (const message of stream) {
        if (message.type === 'assistant') {
          for (const block of message.message.content) {
            if (block.type === 'text') text.push(block.text)
          }
        }
        if (message.type === 'result') return toReply(message, text)
      }
      throw new BrainFailedError('no_result', 'Claude Code ended without a result')
    } catch (err) {
      throw controller.signal.aborted ? new AgentAbortedError() : err
    } finally {
      signal.removeEventListener('abort', forwardAbort)
    }
  }
}

/** Success returns the collected text; any other result is a genuine failure and throws
 *  rather than silently returning an empty completion — the caller can't be trusted to
 *  tell a real failure apart from the intentional "no text this turn" case otherwise. */
function toReply(result: SDKResultMessage, text: string[]): AssistantReply {
  if (result.subtype === 'success' && !result.is_error) {
    return {
      text: text.join('\n\n'),
      toolCalls: [],
      stopReason: 'end_turn',
      refusalExplanation: null,
      raw: null
    }
  }
  const failureText = result.subtype === 'success' ? result.result : result.errors.join('; ')
  if (isSignInFailure(failureText)) throw new ClaudeCodeNotSignedInError()
  throw new BrainFailedError(
    result.subtype,
    failureText || `Claude Code stopped: ${result.subtype}`
  )
}
