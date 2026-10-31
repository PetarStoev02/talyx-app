import type { T3Cli } from '../../../infrastructure/office/T3Cli'
import type { SignalRepo } from '../repository/SignalRepo'
import { InvalidEventError, ThreadNotOwnedError } from '../errors'

export class SendToThread {
  constructor(
    private readonly deps: { t3: Pick<T3Cli, 'send'>; signals: Pick<SignalRepo, 'threadOwner'> }
  ) {}

  async execute(input: { threadId: string; message: string }): Promise<void> {
    if (!input.message.trim()) throw new InvalidEventError('message', 'must not be empty')
    // Only threads the office shows a bot working on, never an arbitrary T3 thread.
    if (this.deps.signals.threadOwner(input.threadId) === null) {
      throw new ThreadNotOwnedError(input.threadId)
    }
    await this.deps.t3.send(input.threadId, input.message)
  }
}
