import { describe, it, expect } from 'vitest'
import { SendGroupMessage } from '../../../src/main/domain/office/useCases/SendGroupMessage'
import {
  BotNotReachableError,
  InvalidEventError,
  NoRelayBotError
} from '../../../src/main/domain/office/errors'
import { WebhookRejectedError } from '../../../src/main/infrastructure/office/WebhookClient'
import { chatWorld } from './chat.setup'

const group = { kind: 'group', groupId: 'g' } as const

describe('SendGroupMessage', () => {
  it('should hand the message to the group’s relay bot', async () => {
    const w = chatWorld({ relay: true, hook: true })
    await new SendGroupMessage(w.deps).execute({ groupId: 'g', text: ' hi ' })
    expect(w.trigger).toHaveBeenCalledOnce()
    expect(w.trigger).toHaveBeenCalledWith('https://hook.example/b', 'KEY', {
      message: 'hi',
      messageId: 'm1',
      group: 'g',
      groupName: 'Team',
      target: 'group',
      bot: 'b'
    })
    const [m] = w.conversation.execute(group)
    expect(m).toMatchObject({ author: 'owner', text: 'hi', status: 'sent' })
  })

  it('should keep the owner message even when the routine fails', async () => {
    const w = chatWorld({ relay: true, hook: true })
    w.trigger.mockRejectedValue(new WebhookRejectedError(500))
    await expect(
      new SendGroupMessage(w.deps).execute({ groupId: 'g', text: 'hi' })
    ).rejects.toThrow(WebhookRejectedError)
    const messages = w.conversation.execute(group)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({ author: 'owner', text: 'hi', status: 'failed' })
  })

  it('should not show a failed group send in the relay bot’s direct chat', async () => {
    const w = chatWorld({ relay: true, hook: true })
    w.trigger.mockRejectedValue(new WebhookRejectedError(500))
    await expect(
      new SendGroupMessage(w.deps).execute({ groupId: 'g', text: 'hi' })
    ).rejects.toThrow()
    expect(w.conversation.execute({ kind: 'bot', botId: 'b' })).toEqual([])
  })

  it('should refuse a group without a relay bot', async () => {
    const w = chatWorld({ hook: true })
    await expect(
      new SendGroupMessage(w.deps).execute({ groupId: 'g', text: 'hi' })
    ).rejects.toThrow(NoRelayBotError)
    expect(w.conversation.execute(group)).toEqual([])
  })

  it('should refuse a relay bot without a webhook key', async () => {
    const w = chatWorld({ relay: true })
    await expect(
      new SendGroupMessage(w.deps).execute({ groupId: 'g', text: 'hi' })
    ).rejects.toThrow(BotNotReachableError)
    expect(w.conversation.execute(group)).toEqual([])
  })

  it('should refuse an empty message', async () => {
    const w = chatWorld({ relay: true, hook: true })
    await expect(
      new SendGroupMessage(w.deps).execute({ groupId: 'g', text: '  ' })
    ).rejects.toThrow(InvalidEventError)
  })
})
