import { existsSync } from 'fs'
import {
  createSdkMcpServer,
  query as sdkQuery,
  type CanUseTool,
  type McpSdkServerConfigWithInstance,
  type ModelInfo,
  type Options,
  type PermissionResult,
  type SDKMessage,
  type SDKResultMessage,
  type SDKUserMessage
} from '@anthropic-ai/claude-agent-sdk'
import type { CapabilityRegistry } from '../../domain/instruction/model/CapabilityRegistry'
import type { CapabilityContext } from '../../domain/instruction/model/Capability'
import { replayText } from '../../domain/conversation/services/replay'
import type { ConversationEntry } from '../../domain/conversation/model/Conversation'
import {
  THINKING,
  type ActionLog,
  type AgentEvent,
  type Brain,
  type PendingProposal,
  type SessionUi
} from '../../domain/agent/Brain'
import type { ModelOption } from '../../domain/agent/ModelProvider'
import { describeToolUse } from '../../domain/agent/describeToolUse'
import { CapabilityDispatcher } from '../../domain/agent/CapabilityDispatcher'
import { ApprovalGate } from '../../domain/agent/ApprovalGate'
import { needsCardDespiteRest } from '../../domain/agent/ApprovalPolicy'
import {
  builtinToolClass,
  describeBuiltinCall,
  DENIED_BUILTINS
} from '../../domain/agent/BuiltinToolPolicy'
import {
  AgentAbortedError,
  BrainFailedError,
  ClaudeCodeNotSignedInError,
  IterationLimitError
} from '../../domain/agent/errors'
import { buildSystemPrompt, localNow } from '../agent/systemPrompt'
import { capabilityToSdkTool } from './capabilityToSdkTool'

export type QueryFn = (params: { prompt: string; options?: Options }) => AsyncIterable<SDKMessage>

/** The streaming-input shape of query(): a live control channel with no prompt yet. */
export type CatalogQueryFn = (params: {
  prompt: AsyncIterable<SDKUserMessage>
  options?: Options
}) => { supportedModels(): Promise<ModelInfo[]>; close(): void }

/** The picker row Claude Code names its own default with; passed to the CLI as "no model". */
export const CLI_DEFAULT_MODEL = 'default'

export interface ClaudeCodeBrainOptions {
  /** Talyx's action-log session id, not Claude Code's. */
  sessionId: string
  home: string
  projectsRoot: string
  claudeCodePath: string
  maxTurns?: number
  /** Read per run, so the picker switches models mid-conversation. Absent = CLI default. */
  model?: () => string
}

interface Logger {
  info(message: string): void
  warn(message: string): void
}

export interface ClaudeCodeBrainDeps {
  registry: CapabilityRegistry
  ui: SessionUi
  log: ActionLog
  emit: (event: AgentEvent) => void
  options: ClaudeCodeBrainOptions
  /** Injected by tests; defaults to the SDK's query(). */
  queryFn?: QueryFn
  logger?: Logger
}

const DEFAULT_MAX_TURNS = 40
const SIGN_IN_TEST_TIMEOUT_MS = 30_000
const CATALOG_TIMEOUT_MS = 15_000
const SIGN_IN_FAILURE =
  /\blog(ged)? ?in\b|\blogged out\b|\bsign(ed)? ?in\b|authenticat|\bapi key\b|unauthori[sz]ed|credential/i
const NOOP_LOGGER: Logger = { info: () => {}, warn: () => {} }
const NO_RESULT_OBSERVED = 'No result observed'
const DEFAULT_TOOL_FAILURE_TEXT = 'Tool failed'

/** A `tool_result` content block as it appears on an SDK user message. Kept local and loose
 *  instead of importing the Anthropic message types, since only these three fields are read. */
interface ToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  is_error?: boolean
  content?: string | Array<{ type: string; text?: string }>
}

function isToolResultBlock(block: unknown): block is ToolResultBlock {
  return (
    typeof block === 'object' &&
    block !== null &&
    (block as { type?: unknown }).type === 'tool_result' &&
    typeof (block as { tool_use_id?: unknown }).tool_use_id === 'string'
  )
}

function toolResultErrorText(block: ToolResultBlock): string {
  if (!Array.isArray(block.content)) return DEFAULT_TOOL_FAILURE_TEXT
  const text = block.content
    .filter((part): part is { type: string; text: string } => typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n')
  return text.length > 0 ? text : DEFAULT_TOOL_FAILURE_TEXT
}

/**
 * The user's own Claude Code drives the conversation on their subscription.
 * Talyx stays the harness: its abilities arrive as MCP tools with their own
 * cards, Claude Code's built-ins pass through canUseTool and the same card,
 * every approved action is logged, and abort() kills the subprocess.
 */
export class ClaudeCodeBrain implements Brain {
  private readonly controller = new AbortController()
  private readonly gate: ApprovalGate
  private readonly mcpServer: McpSdkServerConfigWithInstance
  private readonly queryFn: QueryFn
  private readonly logger: Logger
  /** Approved built-ins awaiting the `tool_result` that says whether they succeeded. */
  private readonly pendingBuiltins = new Map<
    string,
    { proposal: PendingProposal; input: Record<string, unknown> }
  >()
  private claudeSessionId: string | null = null
  /** Answer text held until the next message says whether it was narration. */
  private pendingText: string[] = []
  private running = false
  private replay: string | null = null

  constructor(private readonly deps: ClaudeCodeBrainDeps) {
    this.logger = deps.logger ?? NOOP_LOGGER
    this.queryFn = deps.queryFn ?? (sdkQuery as QueryFn)
    const ctx: CapabilityContext = {
      home: deps.options.home,
      projectsRoot: deps.options.projectsRoot,
      signal: this.controller.signal,
      logger: this.logger
    }
    const dispatcher = new CapabilityDispatcher({
      registry: deps.registry,
      ctx,
      log: deps.log,
      emit: deps.emit,
      sessionId: deps.options.sessionId
    })
    this.gate = new ApprovalGate(deps.ui, this.controller.signal, deps.emit)
    this.mcpServer = createSdkMcpServer({
      name: 'talyx',
      tools: deps.registry.all().map((c) => capabilityToSdkTool(c, dispatcher, this.gate))
    })
  }

  abort(): void {
    this.controller.abort()
    this.gate.abort()
  }

  /**
   * Claude Code can resume its own session on disk through the `resume` option,
   * which would be cheaper than replaying. Kept uniform with the API-key brain
   * so both answer the same way when a session has expired.
   * ponytail: replay costs a longer prompt per continued conversation; switch to
   * the native resume if that shows up in latency or spend.
   */
  resume(entries: ConversationEntry[]): void {
    const text = replayText(entries)
    this.replay = text.length > 0 ? text : null
  }

  async run(instruction: string): Promise<void> {
    if (this.running) throw new Error('ClaudeCodeBrain.run is already in progress')
    this.running = true
    this.gate.reset()
    this.deps.emit({ type: 'status', ...THINKING })
    const prompt = this.replay === null ? instruction : `${this.replay}\n\n${instruction}`
    this.replay = null
    try {
      const stream = this.queryFn({ prompt, options: this.buildOptions() })
      for await (const message of stream) {
        if (this.handle(message) === 'finished') return
      }
      throw new BrainFailedError('no_result', 'Claude Code ended without a result')
    } catch (err) {
      throw this.normalise(err)
    } finally {
      this.running = false
      this.flushText(false)
      // A subprocess killed after approval leaves no tool_result; don't log it as silently ok.
      for (const toolUseID of [...this.pendingBuiltins.keys()]) {
        this.settleBuiltin(toolUseID, false, NO_RESULT_OBSERVED)
      }
    }
  }

  private buildOptions(): Options {
    const { home, projectsRoot, claudeCodePath } = this.deps.options
    return {
      // Spawning in a folder that does not exist kills the CLI before it starts,
      // and its error blames the binary. Owners who do not code have no ~/Code.
      cwd: existsSync(projectsRoot) ? projectsRoot : home,
      pathToClaudeCodeExecutable: claudeCodePath,
      model: toCliModel(this.deps.options.model?.()),
      mcpServers: { talyx: this.mcpServer },
      canUseTool: this.canUseTool,
      disallowedTools: [...DENIED_BUILTINS],
      permissionMode: 'default',
      // Talyx behaviour must not depend on the user's ~/.claude hooks or settings.
      settingSources: [],
      maxTurns: this.maxTurns(),
      includePartialMessages: false,
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code',
        append: buildSystemPrompt({
          home,
          projectsRoot,
          platform: process.platform,
          now: localNow()
        })
      },
      resume: this.claudeSessionId ?? undefined,
      abortController: this.controller,
      stderr: (data) => this.logger.warn(`[claude-code] ${data.trimEnd()}`)
    }
  }

  private flushText(interim: boolean): void {
    if (this.pendingText.length === 0) return
    const text = this.pendingText.join('\n\n')
    this.pendingText = []
    this.deps.emit({ type: 'text', text, interim })
  }

  private maxTurns(): number {
    return this.deps.options.maxTurns ?? DEFAULT_MAX_TURNS
  }

  private handle(message: SDKMessage): 'continue' | 'finished' {
    switch (message.type) {
      case 'system':
        if (message.subtype === 'init') this.claudeSessionId = message.session_id
        return 'continue'
      case 'assistant':
        // Subagent frames carry a parent id; only the main line reaches the transcript.
        if (message.parent_tool_use_id === null) {
          const hasToolUse = message.message.content.some((block) => block.type === 'tool_use')
          // Text turns out to be narration only once a tool call follows it, so it waits.
          if (hasToolUse) this.flushText(true)
          for (const block of message.message.content) {
            if (block.type === 'text' && block.text.trim().length > 0) {
              if (hasToolUse) this.deps.emit({ type: 'text', text: block.text, interim: true })
              else this.pendingText.push(block.text)
            } else if (block.type === 'tool_use') {
              this.deps.emit({ type: 'status', ...describeToolUse(block.name, block.input) })
            }
          }
        }
        return 'continue'
      case 'auth_status':
        if (message.error || message.isAuthenticating) {
          this.claudeSessionId = null
          throw new ClaudeCodeNotSignedInError()
        }
        return 'continue'
      case 'user':
        // A tool answered: anything said before it was narration, and the model is deciding again.
        this.flushText(true)
        if (this.settleFromToolResults(message.message.content)) {
          this.deps.emit({ type: 'status', ...THINKING })
        }
        return 'continue'
      case 'result':
        this.finish(message)
        return 'finished'
      default:
        return 'continue'
    }
  }

  /** Talyx never sees a built-in's outcome until its tool_result comes back on a user message. */
  private settleFromToolResults(content: unknown): boolean {
    const blocks = Array.isArray(content) ? content : []
    const results = blocks.filter(isToolResultBlock)
    for (const block of results) {
      if (!this.pendingBuiltins.has(block.tool_use_id)) continue
      const isError = block.is_error === true
      this.settleBuiltin(block.tool_use_id, !isError, isError ? toolResultErrorText(block) : null)
    }
    return results.length > 0
  }

  private settleBuiltin(toolUseID: string, ok: boolean, error: string | null): void {
    const pending = this.pendingBuiltins.get(toolUseID)
    if (!pending) return
    this.pendingBuiltins.delete(toolUseID)
    const { proposal, input } = pending
    const label = proposal.operations[0]?.label ?? proposal.tool
    this.deps.log.append({
      sessionId: this.deps.options.sessionId,
      proposalId: toolUseID,
      tool: proposal.tool,
      label,
      payload: input,
      inverse: null,
      ok,
      error
    })
    this.deps.emit({ type: 'action', label, ok, error })
  }

  /** Success emits done; every error result forgets the session and throws. */
  private finish(result: SDKResultMessage): void {
    this.flushText(false)
    if (result.subtype === 'success' && !result.is_error) {
      this.deps.emit({ type: 'done' })
      return
    }
    this.claudeSessionId = null
    if (result.subtype === 'error_max_turns') throw new IterationLimitError(this.maxTurns())
    const text = resultText(result)
    if (isSignInFailure(text)) throw new ClaudeCodeNotSignedInError()
    throw new BrainFailedError(result.subtype, text || `Claude Code stopped: ${result.subtype}`)
  }

  private normalise(err: unknown): Error {
    if (this.controller.signal.aborted || err instanceof AgentAbortedError) {
      return new AgentAbortedError()
    }
    if (
      err instanceof BrainFailedError ||
      err instanceof IterationLimitError ||
      err instanceof ClaudeCodeNotSignedInError
    ) {
      return err
    }
    return new BrainFailedError('query_failed', (err as Error).message)
  }

  private readonly canUseTool: CanUseTool = async (toolName, input, { toolUseID }) => {
    switch (builtinToolClass(toolName)) {
      case 'auto':
        return { behavior: 'allow', updatedInput: input }
      case 'deny':
        return { behavior: 'deny', message: 'Not available in Talyx' }
      case 'ask':
        return this.askBuiltin(toolName, input, toolUseID)
    }
  }

  private async askBuiltin(
    toolName: string,
    input: Record<string, unknown>,
    toolUseID: string
  ): Promise<PermissionResult> {
    const proposal = describeBuiltinCall({ id: toolUseID, name: toolName, input })
    const forceCard = needsCardDespiteRest(toolName, input)
    const allowed = await this.gate.ask({ text: '', proposals: [proposal] }, forceCard)
    if (!allowed) return { behavior: 'deny', message: 'User declined' }
    // Logged once its tool_result is observed (settleBuiltin) — approval alone doesn't mean it ran.
    this.pendingBuiltins.set(toolUseID, { proposal, input })
    return { behavior: 'allow', updatedInput: input }
  }
}

export function isSignInFailure(text: string): boolean {
  return SIGN_IN_FAILURE.test(text)
}

function resultText(result: SDKResultMessage): string {
  return result.subtype === 'success' ? result.result : result.errors.join('; ')
}

/**
 * Settings → Test. Sign-in is never inspected (that would mean reading
 * ~/.claude); it is observed through one locked-down turn.
 */
export function toCliModel(model: string | undefined): string | undefined {
  return model === undefined || model === CLI_DEFAULT_MODEL ? undefined : model
}

/**
 * The models this Claude Code binary offers its user, straight from the CLI so
 * Talyx never guesses what a subscription can run. Opens the control channel
 * with a prompt that never arrives, asks, and kills the process.
 */
export async function readClaudeCodeModels(input: {
  claudeCodePath: string
  cwd: string
  queryFn?: CatalogQueryFn
}): Promise<ModelOption[]> {
  const queryFn = input.queryFn ?? (sdkQuery as CatalogQueryFn)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CATALOG_TIMEOUT_MS)
  const session = queryFn({
    prompt: neverPrompt(controller.signal),
    options: {
      cwd: input.cwd,
      pathToClaudeCodeExecutable: input.claudeCodePath,
      tools: [],
      settingSources: [],
      abortController: controller
    }
  })
  try {
    const models = await Promise.race([session.supportedModels(), rejectOnAbort(controller.signal)])
    return models.map((m) => ({ id: m.value, label: m.displayName, description: m.description }))
  } finally {
    clearTimeout(timer)
    controller.abort()
    session.close()
  }
}

// eslint-disable-next-line require-yield
async function* neverPrompt(signal: AbortSignal): AsyncGenerator<SDKUserMessage> {
  await rejectOnAbort(signal)
}

function rejectOnAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) =>
    signal.addEventListener('abort', () => reject(new AgentAbortedError()), { once: true })
  )
}

export async function testClaudeCodeSignIn(input: {
  claudeCodePath: string
  cwd: string
  queryFn?: QueryFn
}): Promise<void> {
  const queryFn = input.queryFn ?? (sdkQuery as QueryFn)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SIGN_IN_TEST_TIMEOUT_MS)
  let sawInit = false
  try {
    const stream = queryFn({
      prompt: 'Reply with OK',
      options: {
        cwd: input.cwd,
        pathToClaudeCodeExecutable: input.claudeCodePath,
        maxTurns: 1,
        tools: [],
        permissionMode: 'default',
        settingSources: [],
        systemPrompt: 'Reply with the word OK and nothing else.',
        abortController: controller
      }
    })
    for await (const message of stream) {
      if (message.type === 'system' && message.subtype === 'init') sawInit = true
      if (message.type === 'auth_status' && (message.error || message.isAuthenticating)) {
        throw new ClaudeCodeNotSignedInError()
      }
      if (message.type === 'result') {
        if (message.subtype === 'success' && !message.is_error) return
        const text = resultText(message)
        if (!sawInit || isSignInFailure(text)) throw new ClaudeCodeNotSignedInError()
        throw new BrainFailedError(message.subtype, text)
      }
    }
    throw new ClaudeCodeNotSignedInError()
  } catch (err) {
    if (controller.signal.aborted) {
      throw new BrainFailedError('timeout', 'Claude Code did not answer within 30 seconds')
    }
    if (err instanceof ClaudeCodeNotSignedInError || err instanceof BrainFailedError) throw err
    throw new BrainFailedError('launch_failed', (err as Error).message)
  } finally {
    clearTimeout(timer)
  }
}
