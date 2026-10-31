import { vi } from 'vitest'
import { RecordSignal } from '../../../src/main/domain/office/useCases/RecordSignal'
import { GetConversation } from '../../../src/main/domain/office/useCases/GetConversation'
import type { OwnerMessageDeps } from '../../../src/main/domain/office/useCases/OwnerMessageSender'
import type { WebhookClient } from '../../../src/main/infrastructure/office/WebhookClient'
import type { RosterRepo } from '../../../src/main/domain/office/repository/RosterRepo'
import type { SignalRepo } from '../../../src/main/domain/office/repository/SignalRepo'
import { emptySignals, fakeSecrets, rosterWithBot } from './rosterUseCases.setup'

export const NOW = new Date('2026-01-01T12:00:00Z')

export interface ChatWorld {
  roster: RosterRepo
  signals: SignalRepo
  trigger: ReturnType<typeof vi.fn>
  deps: OwnerMessageDeps
  conversation: GetConversation
}

/** Bot `b` in group `g` ("Team"); `relay` makes b the relay bot and `hook` gives b a webhook + key. */
export function chatWorld(o: { relay?: boolean; hook?: boolean } = {}): ChatWorld {
  const roster = rosterWithBot()
  const signals = emptySignals()
  const [bot] = roster.allBots()
  if (o.relay) roster.saveGroup({ id: 'g', projectId: 'p', name: 'Team', relayBotId: 'b' })
  if (o.hook) roster.saveBot({ ...bot, webhookUrl: 'https://hook.example/b' })
  const secrets = fakeSecrets(o.hook ? { 'webhook-key:b': 'KEY' } : {})
  const trigger = vi.fn().mockResolvedValue(undefined)
  const deps: OwnerMessageDeps = {
    roster,
    secrets,
    webhook: { trigger } as unknown as WebhookClient,
    record: new RecordSignal({ signals, roster, onChange: () => {} }),
    signals,
    newMessageId: () => 'm1',
    now: () => NOW
  }
  return {
    roster,
    signals,
    trigger,
    deps,
    conversation: new GetConversation({ roster, signals, now: () => NOW })
  }
}
