import { describe, it, expect, vi } from 'vitest'
import { CapabilityRegistry } from '../../../../src/main/domain/instruction/model/CapabilityRegistry'
import {
  messageCapabilities,
  type MessageCapabilityDeps
} from '../../../../src/main/domain/instruction/capabilities/messages'
import {
  AmbiguousRecipientError,
  RecipientNotFoundError
} from '../../../../src/main/domain/instruction/model/errors'
import type {
  Capability,
  CapabilityContext,
  Proposal
} from '../../../../src/main/domain/instruction/model/Capability'

const ctx: CapabilityContext = {
  home: '/Users/test',
  projectsRoot: '/Users/test/Code',
  signal: new AbortController().signal,
  logger: { info: () => {}, warn: () => {} }
}

function deps(overrides: Partial<MessageCapabilityDeps> = {}): MessageCapabilityDeps {
  return {
    resolveRecipient: vi.fn(async () => [{ handle: '+359888123456', display: 'Maria Petrova' }]),
    sendMessage: vi.fn(async () => {}),
    ...overrides
  }
}

function capability(d: MessageCapabilityDeps = deps()): Capability {
  return new CapabilityRegistry(messageCapabilities(d)).get('send_message')!
}

async function propose(
  params: unknown,
  overrides: Partial<MessageCapabilityDeps> = {}
): Promise<{ proposal: Proposal; d: MessageCapabilityDeps }> {
  const d = deps(overrides)
  const cap = capability(d)
  return { proposal: await cap.plan(cap.params.parse(params), ctx), d }
}

describe('send_message', () => {
  it('should resolve the name and put the whole message on the approval card', async () => {
    const { proposal, d } = await propose({ to: 'Maria', text: 'Running 10 minutes late' })
    if (proposal.kind !== 'plan') throw new Error('expected plan')
    expect(d.resolveRecipient).toHaveBeenCalledWith('Maria')
    expect(proposal.summary).toBe('Send a message to Maria Petrova')
    expect(proposal.operations).toHaveLength(1)
    expect(proposal.operations[0].label).toBe(
      'Maria Petrova (+359888123456) — Running 10 minutes late'
    )
    expect(proposal.operations[0].payload).toEqual({
      handle: '+359888123456',
      text: 'Running 10 minutes late'
    })
    expect(proposal.operations[0].inverse).toBeNull()
  })

  it('should never shorten the text, so nobody approves a message they cannot read', async () => {
    const text = 'x'.repeat(400)
    const { proposal } = await propose({ to: 'Maria', text })
    if (proposal.kind !== 'plan') throw new Error('expected plan')
    expect(proposal.operations[0].label).toContain(text)
  })

  it('should send it on execute', async () => {
    const { proposal, d } = await propose({ to: 'Maria', text: 'On my way' })
    if (proposal.kind !== 'plan') throw new Error('expected plan')
    expect(await capability(d).execute!(proposal.operations[0], ctx)).toBe('Message sent')
    expect(d.sendMessage).toHaveBeenCalledWith({ handle: '+359888123456', text: 'On my way' })
  })

  it('should take a raw phone number or email as the recipient, and print it once', async () => {
    const { proposal } = await propose(
      { to: '+359888999000', text: 'Hi' },
      {
        resolveRecipient: vi.fn(async () => [{ handle: '+359888999000', display: '+359888999000' }])
      }
    )
    if (proposal.kind !== 'plan') throw new Error('expected plan')
    expect(proposal.summary).toBe('Send a message to +359888999000')
    expect(proposal.operations[0].label).toBe('+359888999000 — Hi')
  })

  it('should refuse when nobody matches, naming who was looked for', async () => {
    const cap = capability(deps({ resolveRecipient: async () => [] }))
    await expect(cap.plan(cap.params.parse({ to: 'Zzz', text: 'Hi' }), ctx)).rejects.toThrow(
      RecipientNotFoundError
    )
  })

  it('should refuse when several people match, naming them but not their numbers', async () => {
    const cap = capability(
      deps({
        resolveRecipient: async () => [
          { handle: '+359888123456', display: 'Maria Petrova' },
          { handle: 'maria.ivanova@work.example', display: 'Maria Ivanova' }
        ]
      })
    )
    const err = (await cap
      .plan(cap.params.parse({ to: 'Maria', text: 'Hi' }), ctx)
      .catch((e: Error) => e)) as Error
    expect(err).toBeInstanceOf(AmbiguousRecipientError)
    expect(err.message).toContain('Maria Petrova (…3456)')
    expect(err.message).toContain('Maria Ivanova (…mple)')
    // The message becomes a tool result the model reads before anyone approves.
    expect(err.message).not.toContain('+359888123456')
    expect(err.message).not.toContain('maria.ivanova@work.example')
  })

  it('should reject an empty message', () => {
    expect(capability().params.safeParse({ to: 'Maria', text: '' }).success).toBe(false)
  })

  it('should register as a creation that discloses content and cannot be taken back', () => {
    expect(capability().effect).toEqual({
      world: 'creates',
      reversible: false,
      discloses: 'content'
    })
  })
})
