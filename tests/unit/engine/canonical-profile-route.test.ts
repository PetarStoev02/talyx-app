// @vitest-environment node
import { expect, test } from 'vitest'

import { engineDialUrl, EngineGateway } from '@shared/engine/client'

import { installFakeEngineApi } from './fakeEngineApi'

// R5: the primary socket serves every multiplexed profile and the authority selects one PER
// REQUEST from `profile`. A sibling session's rebuilt requests (CAS mutations, prompt replies,
// the compress follow-up resume) must keep the route, or they reach the launch profile.
// Talyx: upstream answers from a real `ws` server; here the gateway sits behind main's socket
// relay, so the fake answers the relayed frames.
test('a sibling profile route survives canonical request translation', async () => {
  const { sent } = installFakeEngineApi((frame) => {
    const snapshot = {
      session_id: 's',
      stored_session_id: 's',
      revision: 2,
      execution_generation: 5,
      messages: [],
      prompts: [
        {
          kind: 'approval',
          prompt_id: 'p1',
          execution_generation: 5,
          command: 'rm -rf build',
          choices: ['once', 'deny']
        }
      ]
    }

    return frame.method === 'session.resume'
      ? snapshot
      : frame.method === 'session.mutate'
        ? {
            session_id: 's',
            revision: 3,
            operation: frame.params.operation,
            title: 'Renamed',
            message_count: 1
          }
        : { status: 'resolved' }
  })
  const client = new EngineGateway()
  const delivered: Array<{ respond: (result: Record<string, unknown>) => void }> = []
  client.onRequest((request) => {
    delivered.push(request)
  })

  try {
    await client.connect(engineDialUrl())
    await client.request('session.resume', { session_id: 's', profile: 'sibling' })
    await client.request('session.title', { session_id: 's', title: 'Renamed', profile: 'sibling' })
    await client.request('session.compress', { session_id: 's', profile: 'sibling' })
    delivered[0]?.respond({ choice: 'once' })
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(sent.map((frame) => [frame.method, frame.params.profile])).toEqual([
      ['session.resume', 'sibling'],
      ['session.mutate', 'sibling'],
      ['session.mutate', 'sibling'],
      ['session.resume', 'sibling'],
      ['approval.respond', 'sibling']
    ])
  } finally {
    client.close()
  }
})
