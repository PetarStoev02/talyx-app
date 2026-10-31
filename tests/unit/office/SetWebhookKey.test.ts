import { describe, it, expect } from 'vitest'
import { SetWebhookKey } from '../../../src/main/domain/office/useCases/SetWebhookKey'
import { UnknownBotError } from '../../../src/main/domain/office/errors'
import { fakeSecrets, rosterWithBot } from './rosterUseCases.setup'

describe('SetWebhookKey', () => {
  it('should store the key for a known bot', () => {
    const secrets = fakeSecrets()
    new SetWebhookKey({ roster: rosterWithBot(), secrets }).execute({ botId: 'b', key: 'k' })
    expect(secrets.get('webhook-key:b')).toBe('k')
  })

  it('should refuse an unknown bot and store nothing', () => {
    const secrets = fakeSecrets()
    const uc = new SetWebhookKey({ roster: rosterWithBot(), secrets })
    expect(() => uc.execute({ botId: 'ghost', key: 'k' })).toThrow(UnknownBotError)
    expect(secrets.values.size).toBe(0)
  })
})
