import { describe, it, expect } from 'vitest'
import { DeleteBot } from '../../../src/main/domain/office/useCases/DeleteBot'
import { emptySignals, fakeSecrets, rosterWithBot } from './rosterUseCases.setup'

describe('DeleteBot', () => {
  it('should remove the bot and its webhook key', () => {
    const roster = rosterWithBot()
    const secrets = fakeSecrets({ 'webhook-key:b': 'k', 'webhook-key:other': 'k2' })
    const signals = emptySignals()

    new DeleteBot({ roster, secrets, signals }).execute('b')

    expect(roster.allBots()).toEqual([])
    expect([...secrets.values.keys()]).toEqual(['webhook-key:other'])
  })

  it("should forget the deleted bot's activity", () => {
    const roster = rosterWithBot()
    const signals = emptySignals()
    signals.append({
      kind: 't3',
      botId: 'b',
      t3ThreadId: 't',
      title: 'x',
      status: 'running',
      link: null,
      at: '2026-01-01T00:00:00Z'
    })

    new DeleteBot({ roster, secrets: fakeSecrets(), signals }).execute('b')

    expect(signals.botTimeline('b', ['t3'], 200)).toEqual([])
  })
})
