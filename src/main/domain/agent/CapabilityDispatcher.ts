import type { CapabilityRegistry } from '../instruction/model/CapabilityRegistry'
import type {
  Capability,
  CapabilityContext,
  Operation,
  Proposal,
  ScreenImage
} from '../instruction/model/Capability'
import type { ToolCall, ToolResult } from './ModelProvider'
import type { ActionLog, AgentEvent, PendingProposal } from './Brain'
import { approvalFor } from './ApprovalPolicy'
import { AgentAbortedError, ReadOnlyProposedChangeError } from './errors'

export interface PendingPlan {
  capability: Capability
  proposal: Extract<Proposal, { kind: 'plan' }>
}

/** Either already answered, or a plan that needs the card before it may run. */
export type DispatchOutcome =
  | { result: ToolResult; pending: null }
  | { result: null; pending: PendingPlan }

export interface CapabilityDispatcherDeps {
  registry: CapabilityRegistry
  ctx: CapabilityContext
  log: ActionLog
  emit: (event: AgentEvent) => void
  sessionId: string
}

const MAX_EVIDENCE_LINES = 50

/**
 * The part of a tool call that does not depend on which model is talking:
 * validate the parameters, plan, execute an approved plan, log every operation.
 * Approval itself stays with the caller — AgentSession asks once per model
 * reply, ClaudeCodeBrain asks once per call.
 */
export class CapabilityDispatcher {
  constructor(private readonly deps: CapabilityDispatcherDeps) {}

  async dispatch(call: ToolCall): Promise<DispatchOutcome> {
    const capability = this.deps.registry.get(call.name)
    if (!capability) return answered(call, `Unknown tool "${call.name}"`, true)

    const parsed = capability.params.safeParse(call.input)
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      return answered(call, `Invalid parameters for ${call.name}: ${issues.join('; ')}`, true)
    }

    // A capability that cannot plan ("no such folder") is a fact the model can
    // act on, not a reason to end the conversation.
    let proposal: Proposal
    try {
      proposal = await capability.plan(parsed.data, this.deps.ctx)
    } catch (err) {
      if (err instanceof AgentAbortedError) throw err
      return answered(call, err instanceof Error ? err.message : String(err), true)
    }

    if (proposal.kind === 'answer') {
      if (proposal.card) this.deps.emit({ type: 'card', card: proposal.card })
      const lines = proposal.evidence
        .slice(0, MAX_EVIDENCE_LINES)
        .map((e) => `${e.source}: ${e.text}`)
      return answered(call, [proposal.summary, ...lines].join('\n'), false, proposal.image)
    }
    if (proposal.operations.length === 0) return answered(call, proposal.summary, false)
    if (approvalFor(capability.effect) === 'auto')
      throw new ReadOnlyProposedChangeError(capability.name)
    return { result: null, pending: { capability, proposal } }
  }

  toProposal(call: ToolCall, pending: PendingPlan): PendingProposal {
    return {
      id: call.id,
      tool: call.name,
      summary: pending.proposal.summary,
      reversible: pending.capability.effect.reversible,
      operations: pending.proposal.operations.map((op) => ({
        label: op.label,
        reason: op.reason
      }))
    }
  }

  /** Runs the operations in order, stops at the first failure, logs each one. */
  async execute(toolUseId: string, pending: PendingPlan): Promise<ToolResult> {
    const { capability, proposal } = pending
    const outputs: string[] = []
    const total = proposal.operations.length
    for (let i = 0; i < total; i++) {
      const op = proposal.operations[i]
      if (this.deps.ctx.signal.aborted) throw new AgentAbortedError()
      try {
        const output = await capability.execute!(op, this.deps.ctx)
        if (output) outputs.push(output)
        this.record(toolUseId, capability.name, op, true, null)
        this.deps.emit({ type: 'action', label: op.label, ok: true, error: null })
      } catch (err) {
        const message = (err as Error).message
        this.record(toolUseId, capability.name, op, false, message)
        this.deps.emit({ type: 'action', label: op.label, ok: false, error: message })
        return {
          toolUseId,
          text: `Failed at "${op.label}": ${message}. ${i} of ${total} operations completed.`,
          isError: true
        }
      }
    }
    return { toolUseId, text: [`Done: ${proposal.summary}`, ...outputs].join('\n'), isError: false }
  }

  private record(
    proposalId: string,
    tool: string,
    op: Operation,
    ok: boolean,
    error: string | null
  ): void {
    this.deps.log.append({
      sessionId: this.deps.sessionId,
      proposalId,
      tool,
      label: op.label,
      payload: op.payload,
      inverse: op.inverse,
      ok,
      error
    })
  }
}

function answered(
  call: ToolCall,
  text: string,
  isError: boolean,
  image?: ScreenImage
): DispatchOutcome {
  return { result: { toolUseId: call.id, text, isError, ...(image && { image }) }, pending: null }
}
