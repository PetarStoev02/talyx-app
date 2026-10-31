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
  { id: 'agro-ops-team', projectId: 'agro-ops', name: 'Agro Ops team' },
  { id: 'agro-ops-clients', projectId: 'agro-ops', name: 'Agro Ops client panel' },
  { id: 'other', projectId: 'agro-ops', name: 'Other' }
]
const EVENTS_URL = 'https://mac.tail1234.ts.net/events'

describe('botInstructions', () => {
  const text = botInstructions({ bot, groups, eventsUrl: EVENTS_URL })

  it('names the bot id and events url', () => {
    expect(text).toContain('agro-ops-cto')
    expect(text).toContain(EVENTS_URL)
  })

  it('never contains a real token', () => {
    expect(text).toContain('Authorization: Bearer <TALYX_TOKEN>')
  })

  it('lists every group id of the bot', () => {
    expect(text).toContain('agro-ops-team')
    expect(text).toContain('agro-ops-clients')
    expect(text).not.toContain('"other"')
  })

  it('gives one curl example per kind', () => {
    for (const kind of ['chat', 'task', 'idle', 'result']) {
      expect(text).toContain(`"kind":"${kind}"`)
    }
    expect(text.match(/curl /g)).toHaveLength(4)
    expect(text).toContain('t3ThreadId')
    expect(text).toContain('runId')
  })

  it('says chat needs a group when the bot is in none', () => {
    const lonely = botInstructions({ bot: { ...bot, groupIds: [] }, groups, eventsUrl: EVENTS_URL })
    expect(lonely).toContain('not in any group')
  })
})
