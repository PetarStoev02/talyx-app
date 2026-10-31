import { OwnerMessageSender } from './OwnerMessageSender'
import { NoRelayBotError, UnknownBotError, UnknownGroupError } from '../errors'

export class SendGroupMessage extends OwnerMessageSender {
  async execute(input: { groupId: string; text: string }): Promise<void> {
    const text = this.cleanText(input.text)
    const group = this.deps.roster
      .listProjects()
      .flatMap((p) => this.deps.roster.listGroups(p.id))
      .find((g) => g.id === input.groupId)
    if (!group) throw new UnknownGroupError(input.groupId)
    if (!group.relayBotId) throw new NoRelayBotError(group.id)
    const relayId = group.relayBotId
    const relay = this.deps.roster.allBots().find((b) => b.id === relayId)
    if (!relay) throw new UnknownBotError(relayId)
    const hook = this.webhookOf(relay)
    const messageId = this.deps.newMessageId()
    await this.deliver(
      hook,
      {
        kind: 'chat',
        botId: relay.id,
        groupId: group.id,
        text,
        author: 'owner',
        messageId,
        at: this.at()
      },
      messageId,
      {
        message: text,
        messageId,
        group: group.id,
        groupName: group.name,
        target: 'group',
        bot: relay.id
      }
    )
  }
}
