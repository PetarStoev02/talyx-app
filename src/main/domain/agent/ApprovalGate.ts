import {
  WAITING,
  type AgentEvent,
  type ApprovalDecision,
  type ApprovalRequest,
  type SessionUi
} from './Brain'
import { AgentAbortedError } from './errors'

/**
 * Per-call approval for brains that ask one card at a time. Holds the
 * "approve the rest of this task" flag and lets abort() reject the card the
 * user is looking at, exactly as AgentSession does for its per-reply card.
 */
export class ApprovalGate {
  private autoApproveRest = false
  private rejectPending: ((err: Error) => void) | null = null

  constructor(
    private readonly ui: SessionUi,
    private readonly signal: AbortSignal,
    private readonly emit: (event: AgentEvent) => void
  ) {}

  /** Call at the start of every run: "rest" means the rest of *this* task. */
  reset(): void {
    this.autoApproveRest = false
  }

  /**
   * True when the action may run, false when the user declined. `forceCard`
   * shows the card even after "rest" (the denylist floor). Rejects with
   * AgentAbortedError when the brain is stopped.
   */
  async ask(request: ApprovalRequest, forceCard: boolean): Promise<boolean> {
    if (this.signal.aborted) throw new AgentAbortedError()
    if (this.autoApproveRest && !forceCard) return true
    this.emit({ type: 'status', ...WAITING })
    const decision = await this.askUser(request)
    if (decision === 'rest') this.autoApproveRest = true
    this.ui.hide()
    return decision !== 'deny'
  }

  abort(): void {
    this.rejectPending?.(new AgentAbortedError())
  }

  private askUser(request: ApprovalRequest): Promise<ApprovalDecision> {
    return new Promise<ApprovalDecision>((resolve, reject) => {
      this.rejectPending = reject
      this.ui.approve(request).then(resolve, reject)
    }).finally(() => {
      this.rejectPending = null
    })
  }
}
