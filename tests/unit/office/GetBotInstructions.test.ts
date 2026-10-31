import { describe, it, expect } from 'vitest'
import { GetBotInstructions } from '../../../src/main/domain/office/useCases/GetBotInstructions'
import { UnknownBotError } from '../../../src/main/domain/office/errors'
import { rosterWithBot } from './rosterUseCases.setup'

describe('GetBotInstructions', () => {
  it('should point the bot at the funnel events url', () => {
    const uc = new GetBotInstructions({
      roster: rosterWithBot(),
      funnelUrl: () => 'https://m.ts.net'
    })
    expect(uc.execute({ botId: 'b' })).toContain('https://m.ts.net/events')
  })

  it('should say to turn on Funnel when it is off', () => {
    const uc = new GetBotInstructions({ roster: rosterWithBot(), funnelUrl: () => null })
    expect(uc.execute({ botId: 'b' })).toContain('<turn on Funnel to get the URL>')
  })

  it('should refuse an unknown bot', () => {
    const uc = new GetBotInstructions({ roster: rosterWithBot(), funnelUrl: () => null })
    expect(() => uc.execute({ botId: 'ghost' })).toThrow(UnknownBotError)
  })
})
