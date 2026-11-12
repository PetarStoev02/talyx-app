import type { TranslationKey } from '@shared/lib/i18n'
import { showMentions } from './mentions'
import type { Mention } from './mentions'
import type { MessageItem, RoomAttachment, RoomEvent } from './types'

// Log rows that say a turn or the room did not go as planned; the rest of the bookkeeping
// (settled turns, renames, finished rounds) stays out of the transcript.
const NOTICES: Record<string, TranslationKey> = {
  'turn.failed': 'rooms.turnFailed',
  'turn.cancelled': 'rooms.turnCancelled',
  'turn.deferred': 'rooms.turnDeferred',
  'member.unavailable': 'rooms.memberUnavailable',
  'room.stop_requested': 'rooms.stopped',
  'authority.lost': 'rooms.authorityLost'
}

export interface RoomLabels {
  // A member's name as the roster shows it (never its handle), and the profile it runs on.
  memberOf: (memberId: string) => { name: string; profile: string }
  // Each member's handle and name: messages show `@name` where they say `@handle`.
  mentions: Mention[]
  t: (key: TranslationKey) => string
}

/** The room's log as the chat transcript's items: each bot reply names its sender. */
export function roomItems(events: RoomEvent[], labels: RoomLabels): MessageItem[] {
  return events.flatMap((event) => roomItem(event, labels))
}

/**
 * A room file in the transcript is addressed by event, attachment, kind and name. Engine names
 * never contain a slash, so the name is the last segment, as the image chip shows it.
 */
export function attachmentKey(eventId: string, attachment: RoomAttachment): string {
  return [eventId, attachment.attachment_id, attachment.kind, attachment.name].join('/')
}

export function parseAttachmentKey(
  key: string
): { eventId: string; attachmentId: string; kind: string } | null {
  const [eventId, attachmentId, kind] = key.split('/')
  return eventId && attachmentId && kind ? { eventId, attachmentId, kind } : null
}

function roomItem(event: RoomEvent, labels: RoomLabels): MessageItem[] {
  const { memberOf, mentions, t } = labels
  const id = event.event_id || String(event.seq)
  const text =
    typeof event.payload.text === 'string' ? showMentions(event.payload.text, mentions) : ''
  if (event.kind === 'message.user') {
    const images = attachmentsOf(event.payload).map((item) => attachmentKey(event.event_id, item))
    return [{ kind: 'user', id, text, images }]
  }
  if (event.kind === 'message.member')
    return text.trim()
      ? [
          {
            kind: 'bot',
            id,
            text,
            streaming: false,
            error: null,
            stopped: false,
            sender: memberOf(event.actor.id)
          }
        ]
      : []
  if (event.kind === 'room.members_changed') return membersChanged(event, id, labels)
  const notice =
    event.kind === 'room.activity' && event.payload.status === 'bounded'
      ? 'rooms.bounded'
      : NOTICES[event.kind]
  if (!notice) return []
  const member = typeof event.payload.member_id === 'string' ? event.payload.member_id : ''
  const detail = [event.payload.error, event.payload.reason].find(
    (value): value is string => typeof value === 'string' && value.trim() !== ''
  )
  const line = t(notice).replace('{name}', member ? memberOf(member).name : '')
  return [{ kind: 'notice', id, text: detail ? `${line}: ${detail}` : line }]
}

// Who joined and who left, by their roster names: "Ledger joined · Scout left".
function membersChanged(event: RoomEvent, id: string, { memberOf, t }: RoomLabels): MessageItem[] {
  const names = (field: string): string[] => {
    const value = event.payload[field]
    return Array.isArray(value)
      ? value
          .filter((item): item is string => typeof item === 'string')
          .map((item) => memberOf(item).name)
      : []
  }
  const parts = [
    ...names('added').map((name) => t('rooms.joined').replace('{name}', name)),
    ...names('removed').map((name) => t('rooms.left').replace('{name}', name))
  ]
  return parts.length ? [{ kind: 'notice', id, text: parts.join(' · ') }] : []
}

function attachmentsOf(payload: Record<string, unknown>): RoomAttachment[] {
  const list = Array.isArray(payload.attachments) ? payload.attachments : []
  return list.filter(
    (item): item is RoomAttachment =>
      !!item &&
      typeof item === 'object' &&
      typeof (item as RoomAttachment).attachment_id === 'string' &&
      typeof (item as RoomAttachment).name === 'string' &&
      typeof (item as RoomAttachment).kind === 'string'
  )
}
