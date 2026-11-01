import type { Group } from '../../../../shared/office'

export const NO_RELAY_HINT = 'Set a relay bot in Settings'

/** Why a group chat cannot send, or null when its relay bot can be called. */
export function groupSendBlocker(
  group: Pick<Group, 'relayBotId'>,
  bots: { id: string; webhookReady: boolean }[]
): string | null {
  const relay = bots.find((b) => b.id === group.relayBotId)
  return relay?.webhookReady ? null : NO_RELAY_HINT
}

/** Keys typed into these belong to the field, not to page shortcuts. */
export function isTextEntry(target: EventTarget | null): boolean {
  const tag = (target as { tagName?: string } | null)?.tagName
  return tag === 'TEXTAREA' || tag === 'INPUT'
}
