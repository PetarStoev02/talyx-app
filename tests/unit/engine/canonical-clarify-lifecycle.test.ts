// Moved from the engine desktop app's canonical clarify lifecycle test (v0.22.5). Upstream drives
// its clarify store and card handler too; those are UI that Talyx writes in PR 4, so these cases
// assert the client contract the card will use: one delivery per prompt, answered once.
import { JsonRpcGatewayClient, type ServerRequest } from '@shared/engine/shared'
import { afterEach, expect, test, vi } from 'vitest'

import { CanonicalDesktopProtocol } from '@shared/engine/canonical-protocol'
import { EngineGateway } from '@shared/engine/client'

afterEach(() => vi.restoreAllMocks())

test.each([{ method: 'session.resume' }, { method: 'session.activate' }])(
  'a question is delivered once and answered once through $method',
  async ({ method }) => {
    vi.spyOn(JsonRpcGatewayClient.prototype, 'connect').mockResolvedValue()

    const wire = vi
      .spyOn(JsonRpcGatewayClient.prototype, 'request')
      .mockImplementation(async (name) => {
        if (name === 'session.resume' || name === 'session.activate') {
          return {
            session_id: 'waiting',
            stored_session_id: 'waiting',
            revision: 1,
            execution_generation: 3,
            running: true,
            messages: [],
            prompts: [
              {
                kind: 'clarify',
                prompt_id: 'question-1',
                execution_generation: 3,
                question: 'Which target?',
                choices: ['staging', 'production']
              }
            ]
          } as never
        }

        return { status: 'resolved' } as never
      })

    const client = new EngineGateway()
    const shown: ServerRequest[] = []
    client.onRequest((request) => {
      shown.push(request)
    })

    try {
      await client.connect('ws://localhost/api/ws?native_dial=fixture')
      await client.request('session.resume', { session_id: 'waiting' })
      // A second snapshot that still lists the open question must not deliver it again.
      await client.request(method, { session_id: 'waiting' })

      expect(shown.map((request) => request.id)).toEqual(['question-1'])

      shown[0].respond?.({ answer: 'staging' })
      shown[0].respond?.({ answer: 'production' })

      await vi.waitFor(() =>
        expect(wire.mock.calls.filter(([name]) => name === 'clarify.respond')).toHaveLength(1)
      )
      expect(wire.mock.calls.some(([name]) => name === 'prompt.submit')).toBe(false)
      expect(wire.mock.calls.find(([name]) => name === 'clarify.respond')).toEqual([
        'clarify.respond',
        {
          session_id: 'waiting',
          profile: 'default',
          execution_generation: 3,
          prompt_id: 'question-1',
          answer: 'staging'
        },
        expect.any(Number),
        undefined
      ])
    } finally {
      client.close()
    }
  }
)

test('snapshots expose batch question params without losing already locked answers', () => {
  const questions = [
    { qid: 'q1', question: 'Which target?', choices: ['staging'], multi_select: false },
    { qid: 'q2', question: 'Which mode?', choices: ['read only'], multi_select: false }
  ]

  const answers = { q1: 'staging' }

  const snapshot = new CanonicalDesktopProtocol().result(
    'session.resume',
    { session_id: 'waiting' },
    {
      session_id: 'waiting',
      revision: 1,
      execution_generation: 3,
      prompts: [
        { kind: 'clarify', prompt_id: 'question-1', questions, answers, execution_generation: 3 }
      ]
    }
  )

  expect(snapshot.open_requests).toEqual([
    {
      id: 'question-1',
      method: 'clarify',
      params: { session_id: 'waiting', questions, answers }
    }
  ])
})
