import { describe, expect, it } from 'vitest'
import {
  botHits,
  cutShort,
  placeHits,
  snippetOf
} from '../../../src/renderer/src/features/chat/botSearch'
import type { RoomLog } from '../../../src/renderer/src/features/chat/botSearch'
import type { Room } from '../../../src/renderer/src/features/bots/types'
import type { ChatItem, RoomEvent } from '../../../src/renderer/src/features/chat/types'

const BOT = 'acme-cfo'

const said = (id: string, text: string): ChatItem => ({ kind: 'user', id, text, images: [] })
const replied = (id: string, text: string): ChatItem => ({
  kind: 'bot',
  id,
  text,
  streaming: false,
  error: null,
  stopped: false,
  sender: null
})
const member = (seq: number, id: string, text: string): RoomEvent => ({
  seq,
  event_id: `e${seq}`,
  kind: 'message.member',
  actor: { kind: 'member', id },
  payload: { text },
  created_at: seq
})
const room = (roomId: string, members: Room['members']): Room => ({
  room_id: roomId,
  name: roomId,
  members
})
const roomLog = (roomId: string, events: RoomEvent[], members: Room['members']): RoomLog => ({
  room: room(roomId, members),
  events
})

describe("searching a bot's messages", () => {
  const chat = [said('1', 'What is the Q3 budget?'), replied('2', 'The budget is 40k.')]
  const team = roomLog(
    'team',
    [
      member(1, BOT, 'Budget first, then hiring.'),
      member(2, 'default', 'The budget looks fine to me.'),
      member(3, BOT, 'Nothing about money here.'),
      { ...member(4, BOT, 'budget'), kind: 'turn.settled' }
    ],
    [{ profile: BOT }, { profile: 'default' }]
  )

  it('should find nothing for a blank query', () => {
    expect(botHits({ profile: BOT, chat, rooms: [team] }, '  ')).toEqual([])
  })

  it('should find nothing when no message has the query', () => {
    expect(botHits({ profile: BOT, chat, rooms: [team] }, 'payroll')).toEqual([])
  })

  it('should find every message in its own chat, newest first, then what it said in rooms', () => {
    expect(
      botHits({ profile: BOT, chat, rooms: [team] }, 'budget').map((hit) => [
        hit.place,
        hit.messageId
      ])
    ).toEqual([
      [{ kind: 'bot', id: BOT }, '2'],
      [{ kind: 'bot', id: BOT }, '1'],
      [{ kind: 'room', id: 'team' }, 'e1']
    ])
  })

  it("should leave out other members' messages and the room's bookkeeping", () => {
    const hits = botHits({ profile: BOT, chat: [], rooms: [team] }, 'budget')
    expect(hits.map((hit) => hit.messageId)).toEqual(['e1'])
  })

  it('should know the bot by the member id a room gave it', () => {
    const seated = roomLog(
      'board',
      [member(1, 'cfo-seat', 'The budget holds.')],
      [{ profile: BOT, member_id: 'cfo-seat' }]
    )
    expect(botHits({ profile: BOT, chat: [], rooms: [seated] }, 'budget')).toHaveLength(1)
  })

  it('should say which messages in its own chat are yours', () => {
    const hits = botHits({ profile: BOT, chat, rooms: [team] }, 'budget')
    expect(hits.map((hit) => hit.fromYou)).toEqual([false, true, false])
  })

  it('should search the words a message shows, not its markdown', () => {
    const [hit] = botHits(
      {
        profile: BOT,
        chat: [replied('2', '**Upside:** a [bigger budget](https://x.test).')],
        rooms: []
      },
      'upside: a bigger'
    )
    expect(hit).toMatchObject({ text: 'Upside: a bigger budget.', match: { start: 0, end: 16 } })
  })

  it('should leave out what the chat does not show: text between tool calls, a hidden brief', () => {
    const tool: ChatItem = {
      kind: 'tool',
      id: 't1',
      name: 'read_file',
      label: 'Reading',
      seconds: 1,
      done: true,
      target: null
    }
    const turn = [
      said('u1', 'Check the budget.'),
      replied('b1', 'Checking the budget file first.'),
      tool,
      replied('b2', 'The budget is fine.'),
      said('u2', '[Workflows brief]\nStart a Workflows task for t-1: budget review')
    ]
    expect(
      botHits({ profile: BOT, chat: turn, rooms: [] }, 'budget').map((hit) => hit.messageId)
    ).toEqual(['b2', 'u1'])
  })

  it('should search only the rooms the bot is in and that still run', () => {
    const closed = { ...roomLog('old', [member(1, BOT, 'budget')], [{ profile: BOT }]) }
    closed.room = { ...closed.room, disbanded_at: 5 }
    const elsewhere = roomLog('other', [member(1, BOT, 'budget')], [{ profile: 'default' }])
    expect(botHits({ profile: BOT, chat: [], rooms: [closed, elsewhere] }, 'budget')).toEqual([])
  })

  it('should give where the first match is in the message', () => {
    const [hit] = botHits(
      { profile: BOT, chat: [replied('2', 'The budget is 40k.')], rooms: [] },
      'BUDGET'
    )
    expect(hit).toMatchObject({ text: 'The budget is 40k.', match: { start: 4, end: 10 } })
  })

  it('should keep the newest hits of each place, so a busy chat leaves room for the rooms', () => {
    const many = Array.from({ length: 150 }, (_, index) =>
      index % 2 ? replied(String(index), 'budget') : said(String(index), 'budget')
    )
    const hits = botHits({ profile: BOT, chat: many, rooms: [team] }, 'budget')
    expect(hits.filter((hit) => hit.place.kind === 'bot')).toHaveLength(50)
    expect(hits[0].messageId).toBe('149')
    expect(hits.filter((hit) => hit.place.kind === 'room')).toHaveLength(1)
  })

  it('should say when a place has more hits than it lists', () => {
    const many = Array.from({ length: 150 }, (_, index) =>
      index % 2 ? replied(String(index), 'budget') : said(String(index), 'budget')
    )
    expect(cutShort(botHits({ profile: BOT, chat: many, rooms: [] }, 'budget'))).toBe(true)
    expect(cutShort(botHits({ profile: BOT, chat, rooms: [team] }, 'budget'))).toBe(false)
  })
})

describe('searching the open chat or room', () => {
  const analyst = { name: 'Analyst', profile: 'analyst' }
  const room = [
    said('e1', 'Should we change the budget?'),
    { ...replied('e2', 'The budget holds.'), sender: analyst },
    { kind: 'notice' as const, id: 'e3', text: 'The budget turn failed' }
  ]

  it('should find its messages newest first, naming who said each', () => {
    const hits = placeHits({ kind: 'room', id: 'team' }, room, 'budget')
    expect(hits.map((hit) => [hit.messageId, hit.fromYou, hit.sender])).toEqual([
      ['e2', false, 'Analyst'],
      ['e1', true, null]
    ])
  })

  it('should find nothing for a blank query', () => {
    expect(placeHits({ kind: 'room', id: 'team' }, room, ' ')).toEqual([])
  })
})

describe('a snippet around a match', () => {
  it('should show a short message whole', () => {
    expect(snippetOf('The budget is 40k.', { start: 4, end: 10 })).toEqual({
      before: 'The ',
      match: 'budget',
      after: ' is 40k.'
    })
  })

  it('should cut a long message around the match, marking each cut', () => {
    const text = `${'a'.repeat(100)} budget ${'b'.repeat(100)}`
    const snippet = snippetOf(text, { start: 101, end: 107 })
    expect(snippet.match).toBe('budget')
    expect(snippet.before.startsWith('…')).toBe(true)
    expect(snippet.after.endsWith('…')).toBe(true)
    expect(snippet.before.length).toBeLessThanOrEqual(41)
  })

  it('should show a message on one line', () => {
    expect(snippetOf('One\nbudget\ntwo', { start: 4, end: 10 })).toEqual({
      before: 'One ',
      match: 'budget',
      after: ' two'
    })
  })
})
