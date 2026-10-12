import { describe, it, expect } from 'vitest'
import Anthropic from '@anthropic-ai/sdk'
import {
  toCreateParams,
  fromMessage,
  toProviderError
} from '../../../src/main/infrastructure/ai-providers/AnthropicProvider'
import { ProviderError } from '../../../src/main/domain/agent/errors'
import type { ConversationMessage } from '../../../src/main/domain/agent/ModelProvider'

const tools = [{ name: 't', description: 'd', input_schema: { type: 'object' as const } }]

describe('toCreateParams', () => {
  it('should send a screenshot result as text plus an image block', () => {
    const messages: ConversationMessage[] = [
      { role: 'user', text: 'what is on screen' },
      {
        role: 'user',
        results: [
          {
            toolUseId: 'a',
            text: 'screen',
            isError: false,
            image: { mediaType: 'image/jpeg', base64: 'AAAA' }
          }
        ]
      }
    ]
    const params = toCreateParams('claude-opus-5', 'sys', messages, tools)
    expect(params.messages[1].content).toEqual([
      {
        type: 'tool_result',
        tool_use_id: 'a',
        content: [
          { type: 'text', text: 'screen' },
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' } }
        ]
      }
    ])
  })

  it('should replay assistant raw content and pack tool results into one user message', () => {
    const raw = [
      { type: 'thinking', thinking: '', signature: 'sig' },
      { type: 'tool_use', id: 'a', name: 't', input: {} }
    ]
    const messages: ConversationMessage[] = [
      { role: 'user', text: 'hi' },
      {
        role: 'assistant',
        reply: { text: '', toolCalls: [], stopReason: 'tool_use', refusalExplanation: null, raw }
      },
      {
        role: 'user',
        results: [
          { toolUseId: 'a', text: 'ok', isError: false },
          { toolUseId: 'b', text: 'no', isError: true }
        ]
      }
    ]
    const params = toCreateParams('claude-opus-5', 'sys', messages, tools)
    expect(params.model).toBe('claude-opus-5')
    expect(params.max_tokens).toBe(8192)
    expect(params.output_config).toEqual({ effort: 'medium' })
    expect(params.system).toEqual([
      { type: 'text', text: 'sys', cache_control: { type: 'ephemeral' } }
    ])
    expect(params.tools?.at(-1)).toMatchObject({ name: 't', cache_control: { type: 'ephemeral' } })
    expect(params.messages[1]).toEqual({ role: 'assistant', content: raw })
    expect(params.messages[2]).toEqual({
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: 'a', content: 'ok' },
        { type: 'tool_result', tool_use_id: 'b', content: 'no', is_error: true }
      ]
    })
  })
})

describe('fromMessage', () => {
  it('should split text and tool calls and carry the refusal explanation', () => {
    const reply = fromMessage({
      content: [
        { type: 'text', text: 'doing it' },
        { type: 'tool_use', id: 'x', name: 't', input: { q: 1 } }
      ],
      stop_reason: 'tool_use',
      stop_details: null
    })
    expect(reply.text).toBe('doing it')
    expect(reply.toolCalls).toEqual([{ id: 'x', name: 't', input: { q: 1 } }])
    expect(reply.stopReason).toBe('tool_use')
    expect(reply.raw).toHaveLength(2)

    const refused = fromMessage({
      content: [],
      stop_reason: 'refusal',
      stop_details: { type: 'refusal', category: 'x', explanation: 'nope' }
    })
    expect(refused.stopReason).toBe('refusal')
    expect(refused.refusalExplanation).toBe('nope')

    expect(
      fromMessage({ content: [], stop_reason: 'model_context_window_exceeded', stop_details: null })
        .stopReason
    ).toBe('other')
  })
})

describe('toProviderError', () => {
  it.each([
    {
      should: 'should map an authentication error to a 401 provider error',
      err: new Anthropic.AuthenticationError(401, undefined, 'x', new Headers()),
      status: 401,
      message: 'API key rejected'
    },
    {
      should: 'should map a rate limit error to a 429 provider error',
      err: new Anthropic.RateLimitError(429, undefined, 'x', new Headers()),
      status: 429,
      message: 'Rate limited, try again in a moment'
    },
    {
      should: 'should map a generic API error to a provider error with its status and message',
      err: new Anthropic.APIError(500, undefined, 'server exploded', new Headers()),
      status: 500,
      // The SDK's own Error#message is status-prefixed (APIError.makeMessage) — assert the
      // real value the mapping passes through, not the constructor's raw message argument.
      message: '500 server exploded'
    }
  ])('$should', ({ err, status, message }) => {
    const result = toProviderError(err)
    expect(result).toBeInstanceOf(ProviderError)
    expect((result as ProviderError).status).toBe(status)
    expect(result.message).toBe(message)
  })

  it('should re-throw an aborted request unchanged', () => {
    const abort = new Anthropic.APIUserAbortError()
    expect(toProviderError(abort)).toBe(abort)
  })
})
