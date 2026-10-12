import type { CapabilityRegistry } from '../instruction/model/CapabilityRegistry'
import type { CapabilityContext } from '../instruction/model/Capability'
import type {
  AssistantReply,
  ConversationMessage,
  ModelProvider,
  ToolCall,
  ToolDefinition,
  ToolResult
} from './ModelProvider'
import { capabilityToTool } from './capabilityToTool'
import { needsCardDespiteRest } from './ApprovalPolicy'
import { AgentAbortedError, IterationLimitError, ReplyTruncatedError } from './errors'
import { CapabilityDispatcher, type PendingPlan } from './CapabilityDispatcher'
import { replayText } from '../conversation/services/replay'
import type { ConversationEntry } from '../conversation/model/Conversation'

import {
  THINKING,
  WAITING,
  type ActionLog,
  type AgentEvent,
  type ApprovalDecision,
  type ApprovalRequest,
  type Brain,
  type SessionUi
} from './Brain'
import { describeToolUse } from './describeToolUse'

export type {
  ActionLog,
  ActionLogEntry,
  AgentEvent,
  ApprovalDecision,
  ApprovalRequest,
  OverlayEvent,
  PendingProposal,
  SessionUi
} from './Brain'

export interface AgentSessionOptions {
  sessionId: string
  home: string
  projectsRoot: string
  maxIterations?: number
}

const DEFAULT_MAX_ITERATIONS = 40

/** A tool call after dispatch: either already answered, or a plan awaiting the card. */
interface Dispatched {
  call: ToolCall
  result: ToolResult | null
  plan: PendingPlan | null
}

/**
 * One conversation with the user's model. The model names abilities; this class
 * validates, asks, executes, logs, and guarantees every tool_use is answered.
 */
export class AgentSession implements Brain {
  private readonly messages: ConversationMessage[] = []
  private readonly controller = new AbortController()
  private readonly ctx: CapabilityContext
  private readonly dispatcher: CapabilityDispatcher
  private autoApproveRest = false
  private rejectPendingApproval: ((err: Error) => void) | null = null
  private running = false
  private replay: string | null = null

  constructor(
    private readonly provider: ModelProvider,
    private readonly registry: CapabilityRegistry,
    private readonly ui: SessionUi,
    log: ActionLog,
    private readonly emit: (event: AgentEvent) => void,
    private readonly options: AgentSessionOptions
  ) {
    this.ctx = {
      home: options.home,
      projectsRoot: options.projectsRoot,
      signal: this.controller.signal,
      logger: { info: () => {}, warn: () => {} }
    }
    this.dispatcher = new CapabilityDispatcher({
      registry,
      ctx: this.ctx,
      log,
      emit,
      sessionId: options.sessionId
    })
  }

  abort(): void {
    this.controller.abort()
    this.rejectPendingApproval?.(new AgentAbortedError())
  }

  /** The earlier turns go in as one user message before the next instruction. */
  resume(entries: ConversationEntry[]): void {
    const text = replayText(entries)
    this.replay = text.length > 0 ? text : null
  }

  async run(instruction: string): Promise<void> {
    if (this.running) throw new Error('AgentSession.run is already in progress')
    this.running = true
    // "Approve the rest of this task" means this task. The session outlives it —
    // the API-key brain is reused for every message in a conversation.
    this.autoApproveRest = false
    try {
      const tools = this.registry.all().map(capabilityToTool)
      const limit = this.options.maxIterations ?? DEFAULT_MAX_ITERATIONS
      if (this.replay !== null) {
        this.messages.push({ role: 'user', text: this.replay })
        this.replay = null
      }
      this.messages.push({ role: 'user', text: instruction })
      this.emit({ type: 'status', ...THINKING })

      for (let iteration = 0; iteration < limit; iteration++) {
        const reply = await this.completeTurn(tools)
        this.messages.push({ role: 'assistant', reply })

        switch (reply.stopReason) {
          case 'refusal':
            this.emit({
              type: 'error',
              key: 'agent_refusal',
              message: reply.refusalExplanation ?? 'The model declined'
            })
            this.emit({ type: 'done' })
            return
          case 'end_turn':
          case 'other':
            this.emit({ type: 'text', text: reply.text, interim: false })
            this.emit({ type: 'done' })
            return
          case 'max_tokens':
            throw new ReplyTruncatedError()
          case 'pause_turn':
            continue
          case 'tool_use':
            break
        }

        if (reply.text.trim().length > 0) {
          this.emit({ type: 'text', text: reply.text, interim: true })
        }
        const dispatched: Dispatched[] = []
        for (const call of reply.toolCalls) {
          this.emit({ type: 'status', ...describeToolUse(call.name, call.input) })
          dispatched.push(await this.dispatch(call))
        }
        await this.approveAndExecute(reply, dispatched)
        this.forgetOlderScreenshots()
        this.messages.push({ role: 'user', results: dispatched.map((d) => d.result!) })
        this.emit({ type: 'status', ...THINKING })
      }
      throw new IterationLimitError(limit)
    } finally {
      this.running = false
    }
  }

  /**
   * Only the newest screenshot stays in the transcript. Each one costs about a
   * thousand tokens on every later request, and the model reads positions off the
   * latest look anyway.
   */
  private forgetOlderScreenshots(): void {
    for (const message of this.messages) {
      if ('results' in message) for (const result of message.results) delete result.image
    }
  }

  /** Normalises an aborted request: the provider may re-throw its own AbortError verbatim. */
  private async completeTurn(tools: ToolDefinition[]): Promise<AssistantReply> {
    try {
      return await this.provider.complete(this.messages, tools, this.controller.signal)
    } catch (err) {
      if (this.controller.signal.aborted) throw new AgentAbortedError()
      throw err
    }
  }

  private async dispatch(call: ToolCall): Promise<Dispatched> {
    const outcome = await this.dispatcher.dispatch(call)
    return { call, result: outcome.result, plan: outcome.pending }
  }

  private async approveAndExecute(reply: AssistantReply, dispatched: Dispatched[]): Promise<void> {
    const pending = dispatched.filter((d) => d.plan !== null)
    if (pending.length === 0) return

    const mustAsk = pending.some(
      (d) =>
        !this.autoApproveRest ||
        d.plan!.proposal.operations.some((op) => needsCardDespiteRest(d.call.name, op.payload))
    )
    if (mustAsk) {
      const decision = await this.askForApproval({
        text: reply.text,
        proposals: pending.map((d) => this.dispatcher.toProposal(d.call, d.plan!))
      })
      if (decision === 'deny') {
        for (const d of pending)
          d.result = { toolUseId: d.call.id, text: 'User declined', isError: false }
        this.ui.hide()
        return
      }
      if (decision === 'rest') this.autoApproveRest = true
      this.ui.hide()
    }

    for (const d of pending) {
      if (this.controller.signal.aborted) throw new AgentAbortedError()
      d.result = await this.dispatcher.execute(d.call.id, d.plan!)
    }
  }

  private askForApproval(request: ApprovalRequest): Promise<ApprovalDecision> {
    if (this.controller.signal.aborted) return Promise.reject(new AgentAbortedError())
    this.emit({ type: 'status', ...WAITING })
    return new Promise<ApprovalDecision>((resolve, reject) => {
      this.rejectPendingApproval = reject
      this.ui.approve(request).then(resolve, reject)
    }).finally(() => {
      this.rejectPendingApproval = null
    })
  }
}
