import Anthropic from '@anthropic-ai/sdk'
import type {
  AssistantReply,
  ConversationMessage,
  ModelOption,
  ModelProvider,
  StopReason,
  ToolDefinition
} from '../../domain/agent/ModelProvider'
import { ProviderError } from '../../domain/agent/errors'

/** Models the API-key brain offers. First entry is the fallback for an unknown stored id. */
export const API_KEY_MODELS = [
  { id: 'claude-opus-5', label: 'Claude Opus 5', description: 'Deep reasoning for most tasks' },
  {
    id: 'claude-fable-5-1',
    label: 'Claude Fable 5.1',
    description: 'Most capable, slowest and priciest'
  },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', description: 'Fast and cheaper' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', description: 'Fastest and cheapest' }
] as const satisfies readonly ModelOption[]

export type AssistantModel = (typeof API_KEY_MODELS)[number]['id']

export function isApiKeyModel(id: string): id is AssistantModel {
  return API_KEY_MODELS.some((m) => m.id === id)
}

const MAX_TOKENS = 8192

type CreateParams = Anthropic.Messages.MessageCreateParamsNonStreaming

/** The shape `fromMessage` needs — a structural subset of Anthropic.Message so tests need no SDK objects. */
export interface ReplyMessage {
  content: Anthropic.Messages.ContentBlock[] | Array<{ type: string; [k: string]: unknown }>
  stop_reason: string | null
  stop_details: { explanation: string | null; [k: string]: unknown } | null
}

export function toCreateParams(
  model: AssistantModel,
  systemPrompt: string,
  messages: ConversationMessage[],
  tools: ToolDefinition[]
): CreateParams {
  const sdkTools: Anthropic.Messages.Tool[] = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Messages.Tool.InputSchema
  }))
  // Cache breakpoint on the last tool: system + tools are the stable prefix
  if (sdkTools.length > 0) sdkTools[sdkTools.length - 1].cache_control = { type: 'ephemeral' }

  return {
    model,
    max_tokens: MAX_TOKENS,
    output_config: { effort: 'medium' },
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    tools: sdkTools,
    messages: messages.map(toMessageParam)
  }
}

function toMessageParam(message: ConversationMessage): Anthropic.Messages.MessageParam {
  if (message.role === 'assistant') {
    return {
      role: 'assistant',
      content: message.reply.raw as Anthropic.Messages.ContentBlockParam[]
    }
  }
  if ('results' in message) {
    return {
      role: 'user',
      content: message.results.map((r) => ({
        type: 'tool_result' as const,
        tool_use_id: r.toolUseId,
        content: r.image
          ? [
              { type: 'text' as const, text: r.text },
              {
                type: 'image' as const,
                source: {
                  type: 'base64' as const,
                  media_type: r.image.mediaType,
                  data: r.image.base64
                }
              }
            ]
          : r.text,
        ...(r.isError ? { is_error: true } : {})
      }))
    }
  }
  return { role: 'user', content: message.text }
}

const STOP_REASONS: Record<string, StopReason> = {
  end_turn: 'end_turn',
  tool_use: 'tool_use',
  max_tokens: 'max_tokens',
  pause_turn: 'pause_turn',
  refusal: 'refusal'
}

export function fromMessage(message: ReplyMessage): AssistantReply {
  const blocks = message.content as Array<{ type: string; [k: string]: unknown }>
  return {
    text: blocks
      .filter((b) => b.type === 'text')
      .map((b) => b.text as string)
      .join('\n'),
    toolCalls: blocks
      .filter((b) => b.type === 'tool_use')
      .map((b) => ({ id: b.id as string, name: b.name as string, input: b.input })),
    stopReason: STOP_REASONS[message.stop_reason ?? ''] ?? 'other',
    refusalExplanation: message.stop_details?.explanation ?? null,
    raw: message.content
  }
}

export class AnthropicProvider implements ModelProvider {
  private readonly client: Anthropic

  constructor(
    apiKey: string,
    /** Read per request, so the picker switches models without losing the conversation. */
    private readonly model: () => AssistantModel,
    /** Read per request too: the prompt carries the clock, and a brain outlives a minute. */
    private readonly systemPrompt: () => string
  ) {
    this.client = new Anthropic({ apiKey })
  }

  async complete(
    messages: ConversationMessage[],
    tools: ToolDefinition[],
    signal: AbortSignal
  ): Promise<AssistantReply> {
    try {
      const message = await this.client.messages.create(
        toCreateParams(this.model(), this.systemPrompt(), messages, tools),
        { signal }
      )
      return fromMessage(message as unknown as ReplyMessage)
    } catch (err) {
      throw toProviderError(err)
    }
  }

  /** One cheap request to prove the key works. */
  static async testKey(apiKey: string): Promise<void> {
    try {
      await new Anthropic({ apiKey }).messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }]
      })
    } catch (err) {
      throw toProviderError(err)
    }
  }
}

/** Exported for its own test coverage — mapping SDK errors to ProviderError is the part worth verifying in isolation. */
export function toProviderError(err: unknown): Error {
  // APIUserAbortError extends APIError, so this must run first or aborts get
  // reported as a rejected request instead of silently stopping.
  if (
    err instanceof Anthropic.APIUserAbortError ||
    (err instanceof Error && err.name === 'AbortError')
  ) {
    return err
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return new ProviderError(401, 'API key rejected')
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new ProviderError(429, 'Rate limited, try again in a moment')
  }
  if (err instanceof Anthropic.APIError) {
    return new ProviderError(err.status ?? null, err.message)
  }
  return new ProviderError(null, err instanceof Error ? err.message : String(err))
}
