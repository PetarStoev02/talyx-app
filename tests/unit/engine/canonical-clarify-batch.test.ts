// @vitest-environment node
import { afterEach, expect, test, vi } from 'vitest'

import { engineDialUrl, EngineGateway } from '@shared/engine/client'

import { installFakeEngineApi } from './fakeEngineApi'

// The owner asks a multi-question clarify as ONE request (the card's single form) only for a turn
// whose submit declared `clarify_batch`; an older owner's closed submit params refuse the key, so
// the client declares it only where `client.capabilities` advertised `canonical_clarify_batch`.
// Talyx: upstream answers from a real `ws` server; here the gateway sits behind main's socket
// relay (the client's `socketFactory`), so the fake answers the relayed frames.
afterEach(() => vi.unstubAllGlobals())

async function submitThrough(
  capabilities: Record<string, unknown> | null
): Promise<Record<string, unknown>[]> {
  const { sent } = installFakeEngineApi(
    (frame) =>
      frame.method === 'session.resume'
        ? {
            session_id: 's',
            revision: 1,
            execution_generation: 1,
            replay_epoch: 'e',
            last_sequence: 0,
            prompts: []
          }
        : {
            admission_id: `a${sent.length}`,
            ref: { session_id: 's' },
            sequence: 1,
            status: 'queued',
            outcome: null,
            authority_epoch: 1,
            execution_generation: 1
          },
    capabilities && { server_requests: ['clarify'], ...capabilities }
  )
  const client = new EngineGateway()

  try {
    await client.connect(engineDialUrl())
    // Let the capability answer land before the turn, as the app's boot does.
    await new Promise((resolve) => setTimeout(resolve, 20))
    await client.request('prompt.submit', { session_id: 's', text: 'one' })
    await client.request('prompt.submit', { session_id: 's', text: 'two' })

    return sent.filter((frame) => frame.method === 'prompt.submit').map((frame) => frame.params)
  } finally {
    client.close()
  }
}

test('every turn declares clarify_batch to an owner advertising canonical_clarify_batch', async () => {
  const submits = await submitThrough({ declines_not_shown: true, canonical_clarify_batch: true })
  expect(submits.map((params) => params.clarify_batch)).toEqual([true, true])
})

test('an older owner (no field, or no client.capabilities at all) never sees the key', async () => {
  for (const capabilities of [{ declines_not_shown: true }, null]) {
    const submits = await submitThrough(capabilities)
    expect(submits).toHaveLength(2)
    expect(submits.some((params) => 'clarify_batch' in params)).toBe(false)
  }
})
