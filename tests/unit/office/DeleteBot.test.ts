import { describe, it, expect } from 'vitest'
import { DeleteBot } from '../../../src/main/domain/office/useCases/DeleteBot'
import { fakeSecrets, rosterWithBot } from './rosterUseCases.setup'

describe('DeleteBot', () => {
  it('should remove the bot and its webhook key', () => {
    const roster = rosterWithBot()
    const secrets = fakeSecrets({ 'webhook-key:b': 'k', 'webhook-key:other': 'k2' })

    new DeleteBot({ roster, secrets }).execute('b')

    expect(roster.allBots()).toEqual([])
    expect([...secrets.values.keys()]).toEqual(['webhook-key:other'])
  })
})
