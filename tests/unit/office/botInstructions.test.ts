import { describe, it, expect } from 'vitest'
import { botInstructions } from '../../../src/main/domain/office/botInstructions'
import type { Bot, Group } from '../../../src/main/domain/office/model'

const bot: Bot = {
  id: 'agro-ops-cto',
  projectId: 'agro-ops',
  name: 'CTO',
  color: '#9a9a9a',
  groupIds: ['agro-ops-team', 'agro-ops-clients'],
  webhookUrl: null,
  t3ProjectIds: [],
  grokLink: null
}
const groups: Group[] = [
  { id: 'agro-ops-team', projectId: 'agro-ops', name: 'Agro Ops team', relayBotId: 'agro-ops-cto' },
  {
    id: 'agro-ops-clients',
    projectId: 'agro-ops',
    name: 'Agro Ops client panel',
    relayBotId: null
  },
  { id: 'other', projectId: 'agro-ops', name: 'Other', relayBotId: null }
]
const EVENTS_URL = 'https://mac.tail1234.ts.net/events'

describe('botInstructions', () => {
  const text = botInstructions({ bot, groups, eventsUrl: EVENTS_URL })

  it('names the bot id and events url', () => {
    expect(text).toContain('agro-ops-cto')
    expect(text).toContain(EVENTS_URL)
  })

  it('should tell the bot to read the URL and token from its secrets', () => {
    expect(text).toContain('TALYX_URL')
    expect(text).toContain('TALYX_TOKEN')
    expect(text).toContain('jq')
    expect(text).toContain(`TALYX_URL = ${EVENTS_URL}`)
    expect(text).not.toMatch(/Bearer [^$\s]/)
  })

  it('lists every group id of the bot', () => {
    expect(text).toContain('agro-ops-team')
    expect(text).toContain('agro-ops-clients')
    expect(text).not.toContain('"other"')
  })

  it('should describe every event kind the bot can send', () => {
    for (const kind of ['chat', 'dm', 'task', 'idle', 'result', 'message']) {
      expect(text).toContain(`"kind": "${kind}"`)
    }
    expect(text).toContain('t3ThreadId')
    expect(text).toContain('runId')
    expect(text).toContain('"to"')
  })

  it("should ask the relay bot to report the owner's group messages", () => {
    expect(text).toContain('"author": "owner", "group"')
    const member = botInstructions({
      bot: { ...bot, id: 'other-bot' },
      groups,
      eventsUrl: EVENTS_URL
    })
    expect(member).not.toContain('"author": "owner", "group"')
  })

  it('should describe direct messages both ways', () => {
    expect(text).toContain('"kind": "dm"')
    expect(text).toContain('"author": "bot"')
  })

  it('should ask the bot to echo the message id only on the owner message', () => {
    expect(text).toContain('"messageId": "<id>"')
    expect(text).toContain('never on your own reply')
  })

  it('should explain what Talyx sends to the routine', () => {
    expect(text).toContain('When Talyx calls your routine')
    expect(text).toContain('"target": "group"')
    expect(text).toContain('Petar (via Talyx): <message>')
    expect(text).toContain('"target": "dm"')
    expect(text).toContain('history')
    expect(text).toContain('Give task')
  })

  it('should explain $TEXT and UTF-8 JSON', () => {
    expect(text).toContain('TEXT')
    expect(text).toContain('UTF-8')
    expect(text).toContain('jq -a')
  })

  it('should keep webhook text from triggering risky actions', () => {
    expect(text).toContain('no payments')
  })

  it('should reply in the language of the message', () => {
    expect(text).toContain('language of the message')
  })

  it('says chat needs a group and gives no chat example when the bot is in none', () => {
    const lonely = botInstructions({ bot: { ...bot, groupIds: [] }, groups, eventsUrl: EVENTS_URL })
    expect(lonely).toContain('not in any group')
    expect(lonely).not.toContain('"kind": "chat"')
  })
})
