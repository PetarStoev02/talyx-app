import { findMatches } from './search'
import { turnView } from './turns'
import type { ChatItem, RoomEvent } from './types'
import { isQuietReply, parseBrief } from './workflowLines'

/** The most hits one search lists per place (your chat, each room); a broader word lists the newest. */
export const MOST_PER_PLACE = 50
// How much text a snippet keeps on each side of the match.
const SNIPPET_SIDE = 40

/** A bot's chat, or a room. */
export interface SearchPlace {
  kind: 'bot' | 'room'
  id: string
}

/** Whether two places are the same chat or room. */
export function samePlace(a: SearchPlace, b: SearchPlace): boolean {
  return a.kind === b.kind && a.id === b.id
}

/**
 * A message that has the query: where it is, its id there, whether you wrote it, its text as the
 * chat shows it, and the first match in that text.
 */
export interface MessageHit {
  place: SearchPlace
  messageId: string
  fromYou: boolean
  // Who wrote it when that is not you or the place's own bot: a room member, a delivering bot.
  sender: string | null
  text: string
  match: { start: number; end: number }
}

/** A room, as much as a search needs of it. */
export interface SearchRoom {
  room_id: string
  members: { profile: string; member_id?: string }[]
  disbanded_at?: number | null
}

/** A room and its whole log. */
export interface RoomLog {
  room: SearchRoom
  events: RoomEvent[]
}

/** The rooms a bot's search reads: the ones it is in that still run. */
export function roomsOf<T extends SearchRoom>(rooms: T[], profile: string): T[] {
  return rooms.filter(
    (room) => !room.disbanded_at && room.members.some((member) => member.profile === profile)
  )
}

/** The open chat's or room's messages that have the query, newest first. */
export function placeHits(place: SearchPlace, items: ChatItem[], query: string): MessageHit[] {
  return matched(messagesOf(place, items), query)
}

/**
 * A bot's messages that have the query: every message in its own chat (yours and its replies),
 * then what it said in each room it is in. Newest first in each place.
 */
export function botHits(
  search: { profile: string; chat: ChatItem[]; rooms: RoomLog[] },
  query: string
): MessageHit[] {
  // What the chat shows: a turn's last reply, not its text between tool calls; no progress
  // reports; a Workflows brief shows as a card, not its text.
  const shown = turnView(search.chat, false).items.filter(
    (item) => !isQuietReply(item) && !(item.kind === 'user' && parseBrief(item.text))
  )
  const own = messagesOf({ kind: 'bot', id: search.profile }, shown)
  const said = search.rooms.flatMap(({ room, events }) => {
    if (!roomsOf([room], search.profile).length) return []
    const seat = room.members.find((member) => member.profile === search.profile)
    const memberId = seat?.member_id ?? seat?.profile
    return [...events]
      .reverse()
      .filter((event) => event.kind === 'message.member' && event.actor.id === memberId)
      .map((event) => ({
        place: { kind: 'room' as const, id: room.room_id },
        messageId: event.event_id || String(event.seq),
        fromYou: false,
        sender: null,
        text: shownText(typeof event.payload.text === 'string' ? event.payload.text : '')
      }))
  })
  return matched([...own, ...said], query)
}

type Message = Omit<MessageHit, 'match'>

// The place's messages, yours and the replies, newest first, as the chat shows their text.
function messagesOf(place: SearchPlace, items: ChatItem[]): Message[] {
  return [...items].reverse().flatMap((item) =>
    item.kind === 'user' || item.kind === 'bot'
      ? [
          {
            place,
            messageId: item.id,
            fromYou: item.kind === 'user',
            sender: item.kind === 'bot' ? (item.sender?.name ?? null) : null,
            text: shownText(item.text)
          }
        ]
      : []
  )
}

// The messages that have the query, each with its first match, the newest few in each place.
function matched(messages: Message[], query: string): MessageHit[] {
  const first = new Map<number, { start: number; end: number }>()
  for (const { text, start, end } of findMatches(
    messages.map((message) => message.text),
    query
  ))
    if (!first.has(text)) first.set(text, { start, end })
  const perPlace = new Map<string, number>()
  return messages
    .flatMap((message, index) => {
      const match = first.get(index)
      return match ? [{ ...message, match }] : []
    })
    .filter((hit) => {
      const key = `${hit.place.kind}:${hit.place.id}`
      const seen = perPlace.get(key) ?? 0
      perPlace.set(key, seen + 1)
      return seen < MOST_PER_PLACE
    })
}

/** Whether some place has as many hits as a search lists for one, so older ones may be left out. */
export function cutShort(hits: MessageHit[]): boolean {
  const counts = new Map<string, number>()
  for (const { place } of hits) {
    const key = `${place.kind}:${place.id}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.values()].some((count) => count >= MOST_PER_PLACE)
}

/** The match with a little text around it, on one line; a cut side ends in an ellipsis. */
export function snippetOf(
  text: string,
  match: { start: number; end: number }
): { before: string; match: string; after: string } {
  const line = (part: string): string => part.replace(/\s+/g, ' ')
  const from = Math.max(0, match.start - SNIPPET_SIDE)
  const to = Math.min(text.length, match.end + SNIPPET_SIDE)
  return {
    before: (from > 0 ? '…' : '') + line(text.slice(from, match.start)).trimStart(),
    match: line(text.slice(match.start, match.end)),
    after: line(text.slice(match.end, to)).trimEnd() + (to < text.length ? '…' : '')
  }
}

// ponytail: the common markdown marks only (emphasis, code, headings, links); a table or a list
// keeps its pipes and dashes. Close enough for a snippet and for matching the words you saw.
function shownText(markdown: string): string {
  return markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*\*|__|`)/g, '')
}
