import { z } from 'zod/v4'
import type { Capability, Proposal } from '../model/Capability'
import type { Effect } from '../model/Effect'
import { AmbiguousRecipientError, RecipientNotFoundError } from '../model/errors'

/** One way to reach a person: what Messages sends to, and what the user calls them. */
export interface Recipient {
  /** Phone number or email address, exactly as Messages needs it. */
  handle: string
  /** What the approval card shows — the contact's name, or the handle itself. */
  display: string
}

export interface MessageCapabilityDeps {
  /** Everyone matching a name, a phone number or an email address. */
  resolveRecipient(query: string): Promise<Recipient[]>
  sendMessage(input: { handle: string; text: string }): Promise<void>
}

export type SendMessagePayload = { handle: string; text: string }

/** A sent message is out of our hands, and its text leaves this machine. */
const ONE_WAY_SEND: Effect = { world: 'creates', reversible: false, discloses: 'content' }

export function messageCapabilities(deps: MessageCapabilityDeps): Capability[] {
  const sendMessage: Capability<{ to: string; text: string }> = {
    name: 'send_message',
    description: 'Send an iMessage through the Messages app',
    examples: [
      'text Maria that I am running late',
      'message dad happy birthday',
      'send a message to +359888123456 saying the key is under the mat'
    ],
    params: z.object({
      to: z.string().min(1).describe('Contact name, phone number or email address'),
      text: z.string().min(1).describe('The message, exactly as it should be sent')
    }),
    effect: ONE_WAY_SEND,
    async plan({ to, text }): Promise<Proposal> {
      const matches = await deps.resolveRecipient(to)
      if (matches.length === 0) throw new RecipientNotFoundError(to)
      if (matches.length > 1) {
        throw new AmbiguousRecipientError(to, matches.map(describeCandidate))
      }
      const [recipient] = matches
      return {
        kind: 'plan',
        summary: `Send a message to ${recipient.display}`,
        operations: [
          {
            // Never shortened: an unsendable-back message must be readable in full
            // on the card that approves it.
            label: `${nameAndHandle(recipient)} — ${text}`,
            reason: 'message',
            payload: { handle: recipient.handle, text } satisfies SendMessagePayload,
            inverse: null
          }
        ]
      }
    },
    async execute(op) {
      await deps.sendMessage(op.payload as SendMessagePayload)
      return 'Message sent'
    }
  }

  return [sendMessage as Capability]
}

/** "Maria (+359…)" for a contact, plain "+359…" when that is all the user gave. */
function nameAndHandle(recipient: Recipient): string {
  return recipient.display === recipient.handle
    ? recipient.handle
    : `${recipient.display} (${recipient.handle})`
}

const VISIBLE_HANDLE_CHARS = 4

/** Enough for the user to tell two Marias apart, not enough to be a contact detail. */
function describeCandidate(recipient: Recipient): string {
  return `${recipient.display} (…${recipient.handle.slice(-VISIBLE_HANDLE_CHARS)})`
}
