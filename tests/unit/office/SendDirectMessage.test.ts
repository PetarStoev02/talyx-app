import { describe, it, expect } from 'vitest'
import { SendDirectMessage } from '../../../src/main/domain/office/useCases/SendDirectMessage'
import { BotNotReachableError } from '../../../src/main/domain/office/errors'
import { chatWorld } from './chat.setup'

const bot = { kind: 'bot', botId: 'b' } as const

describe('SendDirectMessage', () => {
  it('should send the last 15 messages as history', async () => {
    const w = chatWorld({ hook: true })
    for (let i = 0; i < 20; i++) {
      w.signals.append({
        kind: 'dm',
        botId: 'b',
        author: i % 2 ? 'bot' : 'owner',
        text: `old${i}`,
        messageId: `o${i}`,
        at: new Date(Date.UTC(2025, 11, 31, 0, i)).toISOString()
      })
    }
    await new SendDirectMessage(w.deps).execute({ botId: 'b', text: 'now' })
    const body = w.trigger.mock.calls[0][2]
    expect(body).toMatchObject({ message: 'now', messageId: 'm1', target: 'dm', bot: 'b' })
    expect(body.history).toHaveLength(15)
    expect(body.history.at(-1)).toEqual({ author: 'B', text: 'old19' })
    expect(body.history[1]).toEqual({ author: 'Petar', text: 'old6' })
    expect(body.history[0]).toEqual({ author: 'B', text: 'old5' })
  })

  it('should keep the message as failed when the bot cannot be reached', async () => {
    const w = chatWorld()
    await expect(new SendDirectMessage(w.deps).execute({ botId: 'b', text: 'hi' })).rejects.toThrow(
      BotNotReachableError
    )
    expect(w.conversation.execute(bot)).toEqual([])
  })

  it('should keep the message as failed when the routine fails', async () => {
    const w = chatWorld({ hook: true })
    w.trigger.mockRejectedValue(new Error('down'))
    await expect(
      new SendDirectMessage(w.deps).execute({ botId: 'b', text: 'hi' })
    ).rejects.toThrow()
    expect(w.conversation.execute(bot)).toMatchObject([{ text: 'hi', status: 'failed' }])
  })
})
