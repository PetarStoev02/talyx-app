import type { T3Cli } from '../../../infrastructure/office/T3Cli'
import { InvalidEventError } from '../errors'

export class SendToThread {
  constructor(private readonly deps: { t3: Pick<T3Cli, 'send'> }) {}

  async execute(input: { threadId: string; message: string }): Promise<void> {
    if (!input.message.trim()) throw new InvalidEventError('message', 'must not be empty')
    await this.deps.t3.send(input.threadId, input.message)
  }
}
