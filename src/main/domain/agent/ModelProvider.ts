import type { ScreenImage } from '../instruction/model/Capability'

export interface ToolDefinition {
  name: string
  description: string
  input_schema: { type: 'object'; [k: string]: unknown }
}

export interface ToolCall {
  id: string
  name: string
  input: unknown
}

export interface ToolResult {
  toolUseId: string
  text: string
  isError: boolean
  image?: ScreenImage
}

/** One entry in the model picker: what the brain accepts as `model`, and how to show it. */
export interface ModelOption {
  id: string
  label: string
  description: string
}

export type StopReason = 'end_turn' | 'tool_use' | 'max_tokens' | 'pause_turn' | 'refusal' | 'other'

export interface AssistantReply {
  text: string
  toolCalls: ToolCall[]
  stopReason: StopReason
  refusalExplanation: string | null
  /** Provider-specific content, replayed verbatim (thinking blocks live here). */
  raw: unknown
}

export type ConversationMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; reply: AssistantReply }
  | { role: 'user'; results: ToolResult[] }

export interface ModelProvider {
  complete(
    messages: ConversationMessage[],
    tools: ToolDefinition[],
    signal: AbortSignal
  ): Promise<AssistantReply>
}
