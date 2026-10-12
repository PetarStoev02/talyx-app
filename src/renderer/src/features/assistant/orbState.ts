import type { OrbState } from 'thinking-orbs'
import type { ActivityStatus } from '@shared/api/agent'
import type { TranslationKey } from '@shared/lib/i18n'

const ORB_BY_STATE: Record<ActivityStatus['state'], OrbState> = {
  thinking: 'solving',
  searching: 'searching',
  working: 'working',
  waiting: 'listening'
}

/**
 * Speaking wins over everything: while Talyx is talking, that is what the orb shows.
 * Otherwise a live run picks the orb for what the brain does, and idle keeps the
 * calm "connecting" pulse.
 */
export function orbStateFor(status: ActivityStatus | null, speaking = false): OrbState {
  if (speaking) return 'composing'
  return status ? ORB_BY_STATE[status.state] : 'connecting'
}

/** Tool statuses carry their own literal label; the fixed states are translated. */
export function statusLabelKey(status: ActivityStatus): TranslationKey | null {
  if (status.label.length > 0) return null
  return status.state === 'waiting' ? 'assistant.status.waiting' : 'assistant.status.thinking'
}
