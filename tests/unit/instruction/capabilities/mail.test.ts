import { describe, it, expect, vi } from 'vitest'
import { CapabilityRegistry } from '../../../../src/main/domain/instruction/model/CapabilityRegistry'
import {
  mailCapabilities,
  type MailCapabilityDeps
} from '../../../../src/main/domain/instruction/capabilities/mail'
import type { CapabilityContext } from '../../../../src/main/domain/instruction/model/Capability'

const ctx: CapabilityContext = {
  home: '/Users/test',
  projectsRoot: '/Users/test/Code',
  signal: new AbortController().signal,
  logger: { info: () => {}, warn: () => {} }
}

const message = {
  from: 'Anna <anna@example.com>',
  subject: 'Invoice 2025-09',
  receivedAt: '2026-09-15T07:30:00.000Z',
  preview: 'Hi Petar, attached is the invoice for'
}

function deps(messages = [message]): MailCapabilityDeps {
  return { unreadMessages: vi.fn(async () => messages) }
}

describe('unread_mail', () => {
  it('should list unread messages with sender and subject and attach a mail card', async () => {
    const d = deps()
    const cap = new CapabilityRegistry(mailCapabilities(d)).get('unread_mail')!
    const proposal = await cap.plan(cap.params.parse({}), ctx)
    if (proposal.kind !== 'answer') throw new Error('expected answer')
    expect(d.unreadMessages).toHaveBeenCalledWith(20)
    expect(proposal.summary).toBe('1 unread message')
    expect(proposal.evidence).toEqual([
      {
        source: 'Anna <anna@example.com>',
        text: 'Invoice 2025-09 — Hi Petar, attached is the invoice for'
      }
    ])
    expect(proposal.card).toEqual({ kind: 'mail', messages: [message] })
  })

  it('should say when the inbox is clear', async () => {
    const cap = new CapabilityRegistry(mailCapabilities(deps([]))).get('unread_mail')!
    const proposal = await cap.plan(cap.params.parse({}), ctx)
    expect(proposal.summary).toBe('No unread mail')
  })

  it('should disclose content and stay read-only', () => {
    const cap = new CapabilityRegistry(mailCapabilities(deps())).get('unread_mail')!
    expect(cap.effect).toEqual({ world: 'reads', reversible: false, discloses: 'content' })
  })
})
