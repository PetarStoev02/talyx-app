import { randomUUID } from 'crypto'
import type { CapabilityRegistry } from '../instruction/model/CapabilityRegistry'
import type { CapabilityContext } from '../instruction/model/Capability'
import type { ActionLog, AgentEvent, ApprovalDecision, ApprovalRequest } from '../agent/Brain'
import { CapabilityDispatcher } from '../agent/CapabilityDispatcher'
import { AgentAbortedError } from '../agent/errors'
import { routeCapture } from './CaptureRouter'
import type { CaptureDestination, CaptureRoute } from './CaptureTypes'
import type { CaptureLogRepo } from './CaptureLogRepo'

/** Claude route must finish under this so dump+write can clear 5s when Claude is up. */
export const CAPTURE_ROUTE_MS = 4000

export interface CaptureClaude {
  complete: (
    messages: Array<{ role: 'user'; text: string }>,
    signal: AbortSignal
  ) => Promise<{ text: string }>
}

export interface CaptureRunnerDeps {
  registry: CapabilityRegistry
  ctx: CapabilityContext
  log: ActionLog
  emit: (event: AgentEvent) => void
  sessionId: string
  approve: (request: ApprovalRequest) => Promise<ApprovalDecision>
  captureLog: CaptureLogRepo
  findClaude: () => CaptureClaude | null
  now: () => Date
}

export interface DumpInput {
  text: string
  chip: CaptureDestination | null
}

/**
 * Route a dump, ask for approval once, execute, and record for the habit gate.
 */
export async function runCapture(deps: CaptureRunnerDeps, input: DumpInput): Promise<CaptureRoute> {
  const now = deps.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CAPTURE_ROUTE_MS)
  const onParentAbort = (): void => controller.abort()
  deps.ctx.signal.addEventListener('abort', onParentAbort)
  let route: CaptureRoute
  try {
    route = await routeCapture({
      text: input.text,
      chip: input.chip,
      claude: deps.findClaude(),
      now,
      signal: controller.signal
    })
  } finally {
    clearTimeout(timer)
    deps.ctx.signal.removeEventListener('abort', onParentAbort)
  }
  if (deps.ctx.signal.aborted) throw new AgentAbortedError()

  deps.emit({
    type: 'status',
    state: 'working',
    label: `Saving as ${route.destination}…`
  })

  const dispatcher = new CapabilityDispatcher({
    registry: deps.registry,
    ctx: deps.ctx,
    log: deps.log,
    emit: deps.emit,
    sessionId: deps.sessionId
  })

  const toolUseId = randomUUID()
  const outcome = await dispatcher.dispatch({
    id: toolUseId,
    name: route.tool,
    input: route.input
  })

  if (outcome.result) {
    if (outcome.result.isError) {
      deps.emit({
        type: 'error',
        key: 'capture_failed',
        message: outcome.result.text
      })
      return route
    }
    deps.captureLog.record({ destination: route.destination, at: now })
    deps.emit({ type: 'text', text: outcome.result.text, interim: false })
    return route
  }

  const pending = outcome.pending!
  const proposal = dispatcher.toProposal(
    { id: toolUseId, name: route.tool, input: route.input },
    pending
  )
  const decision = await deps.approve({
    text: '',
    proposals: [proposal]
  })
  if (decision === 'deny') {
    deps.emit({ type: 'text', text: 'Capture cancelled', interim: false })
    return route
  }

  const result = await dispatcher.execute(toolUseId, pending)
  if (result.isError) {
    deps.emit({ type: 'error', key: 'capture_failed', message: result.text })
    return route
  }
  deps.captureLog.record({ destination: route.destination, at: now })
  deps.emit({ type: 'text', text: result.text, interim: false })
  return route
}
