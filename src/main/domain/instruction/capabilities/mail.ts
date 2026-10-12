import { z } from 'zod/v4'
import type { Capability, MailMessage, Proposal } from '../model/Capability'
import type { Effect } from '../model/Effect'

export interface MailCapabilityDeps {
  /** Unread inbox messages, newest first. */
  unreadMessages(limit: number): Promise<MailMessage[]>
}

/** Subjects and previews go to the model so it can say what matters. */
const READS_CONTENT: Effect = { world: 'reads', reversible: false, discloses: 'content' }
const DEFAULT_LIMIT = 20

export function mailCapabilities(deps: MailCapabilityDeps): Capability[] {
  const unreadMail: Capability<{ limit: number }> = {
    name: 'unread_mail',
    description: 'Show the unread messages in the inbox',
    examples: ['anything important in my inbox', 'do I have new mail', 'unread emails'],
    params: z.object({ limit: z.number().int().min(1).max(50).default(DEFAULT_LIMIT) }),
    effect: READS_CONTENT,
    async plan({ limit }): Promise<Proposal> {
      const messages = await deps.unreadMessages(limit)
      return {
        kind: 'answer',
        summary:
          messages.length === 0
            ? 'No unread mail'
            : `${messages.length} unread message${messages.length === 1 ? '' : 's'}`,
        evidence: messages.map((m) => ({
          source: m.from,
          text: m.preview ? `${m.subject} — ${m.preview}` : m.subject
        })),
        card: { kind: 'mail', messages }
      }
    }
  }

  return [unreadMail as Capability]
}
