import { describe, it, expect } from 'vitest'
import { ClaudeCodeProvider } from '../../../src/main/infrastructure/ai-providers/ClaudeCodeProvider'
import {
  AgentAbortedError,
  BrainFailedError,
  ClaudeCodeNotSignedInError
} from '../../../src/main/domain/agent/errors'

function fakeQuery(reply: string) {
  return () =>
    (async function* () {
      yield { type: 'assistant', message: { content: [{ type: 'text', text: reply }] } }
      yield { type: 'result', subtype: 'success' }
    })()
}

describe('ClaudeCodeProvider', () => {
  it('should return the text Claude Code printed', async () => {
    const provider = new ClaudeCodeProvider({
      claudeCodePath: '/usr/local/bin/claude',
      model: 'sonnet',
      runQuery: fakeQuery('{"answer":"ok"}') as never
    })

    const reply = await provider.complete(
      [{ role: 'user', text: 'classify this' }],
      [],
      new AbortController().signal
    )

    expect(reply.text).toBe('{"answer":"ok"}')
    expect(reply.toolCalls).toEqual([])
    expect(reply.stopReason).toBe('end_turn')
  })

  it('should return empty text rather than throw when no assistant message arrives', async () => {
    const runQuery = (() =>
      (async function* () {
        yield { type: 'result', subtype: 'success' }
      })()) as never
    const provider = new ClaudeCodeProvider({
      claudeCodePath: '/usr/local/bin/claude',
      model: 'sonnet',
      runQuery
    })

    const reply = await provider.complete([], [], new AbortController().signal)

    expect(reply.text).toBe('')
  })

  it('should throw rather than return an empty completion when the result is an error', async () => {
    const runQuery = (() =>
      (async function* () {
        yield {
          type: 'result',
          subtype: 'error_during_execution',
          is_error: true,
          errors: ['the model overloaded']
        }
      })()) as never
    const provider = new ClaudeCodeProvider({
      claudeCodePath: '/usr/local/bin/claude',
      model: 'sonnet',
      runQuery
    })

    const pending = provider.complete([], [], new AbortController().signal)

    await expect(pending).rejects.toBeInstanceOf(BrainFailedError)
    await expect(pending).rejects.toThrow('the model overloaded')
  })

  it('should throw a sign-in error when the result says Claude Code is logged out', async () => {
    const runQuery = (() =>
      (async function* () {
        yield {
          type: 'result',
          subtype: 'error_during_execution',
          is_error: true,
          errors: ['Not logged in']
        }
      })()) as never
    const provider = new ClaudeCodeProvider({
      claudeCodePath: '/usr/local/bin/claude',
      model: 'sonnet',
      runQuery
    })

    await expect(provider.complete([], [], new AbortController().signal)).rejects.toBeInstanceOf(
      ClaudeCodeNotSignedInError
    )
  })

  it('should reject without spawning the query when the signal is already aborted', async () => {
    let called = false
    const runQuery = (() => {
      called = true
      return (async function* () {
        yield { type: 'result', subtype: 'success' }
      })()
    }) as never
    const provider = new ClaudeCodeProvider({
      claudeCodePath: '/usr/local/bin/claude',
      model: 'sonnet',
      runQuery
    })
    const controller = new AbortController()
    controller.abort()

    await expect(provider.complete([], [], controller.signal)).rejects.toBeInstanceOf(
      AgentAbortedError
    )
    expect(called).toBe(false)
  })

  it('should reject and abort the query when the caller signal aborts mid-stream', async () => {
    const controller = new AbortController()
    let sdkAbortController: AbortController | undefined

    // Never yields; rejects when the abort controller fires, like the real SDK
    // (mirrors hangUntilAborted in tests/unit/brains/ClaudeCodeBrain.test.ts).
    const runQuery = ((params: { options?: { abortController?: AbortController } }) => {
      sdkAbortController = params.options?.abortController
      // eslint-disable-next-line require-yield
      return (async function* () {
        await new Promise((_resolve, reject) => {
          sdkAbortController?.signal.addEventListener('abort', () => reject(new Error('killed')))
        })
      })()
    }) as never

    const provider = new ClaudeCodeProvider({
      claudeCodePath: '/usr/local/bin/claude',
      model: 'sonnet',
      runQuery
    })

    const pending = provider.complete([{ role: 'user', text: 'hi' }], [], controller.signal)
    controller.abort()

    await expect(pending).rejects.toBeInstanceOf(AgentAbortedError)
    expect(sdkAbortController?.signal.aborted).toBe(true)
  })
})
