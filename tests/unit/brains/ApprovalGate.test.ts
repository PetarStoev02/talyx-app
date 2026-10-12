import { describe, it, expect, vi } from 'vitest'
import { ApprovalGate } from '../../../src/main/domain/agent/ApprovalGate'
import type {
  AgentEvent,
  ApprovalDecision,
  ApprovalRequest
} from '../../../src/main/domain/agent/Brain'
import { AgentAbortedError } from '../../../src/main/domain/agent/errors'

const request: ApprovalRequest = {
  text: '',
  proposals: [
    {
      id: 'p1',
      tool: 'Bash',
      summary: 'Run a command',
      reversible: false,
      operations: [{ label: '$ npm test', reason: '' }]
    }
  ]
}

function harness(decisions: ApprovalDecision[]): {
  gate: ApprovalGate
  approve: ReturnType<typeof vi.fn>
  hide: ReturnType<typeof vi.fn>
  controller: AbortController
  events: AgentEvent[]
} {
  const controller = new AbortController()
  const approve = vi.fn(async () => {
    const next = decisions.shift()
    if (next === undefined) return new Promise<ApprovalDecision>(() => {})
    return next
  })
  const hide = vi.fn()
  const events: AgentEvent[] = []
  return {
    gate: new ApprovalGate({ approve, hide }, controller.signal, (e) => events.push(e)),
    approve,
    hide,
    controller,
    events
  }
}

describe('ApprovalGate', () => {
  it('should resolve true on approve and hide the overlay afterwards', async () => {
    const { gate, hide } = harness(['approve'])
    await expect(gate.ask(request, false)).resolves.toBe(true)
    expect(hide).toHaveBeenCalledTimes(1)
  })

  it('should resolve false on deny', async () => {
    const { gate } = harness(['deny'])
    await expect(gate.ask(request, false)).resolves.toBe(false)
  })

  it('should skip later cards after "rest" until reset', async () => {
    const { gate, approve } = harness(['rest', 'approve'])
    await expect(gate.ask(request, false)).resolves.toBe(true)
    await expect(gate.ask(request, false)).resolves.toBe(true)
    expect(approve).toHaveBeenCalledTimes(1)
    gate.reset()
    await gate.ask(request, false)
    expect(approve).toHaveBeenCalledTimes(2)
  })

  it('should still show the card after "rest" when forceCard is set', async () => {
    const { gate, approve } = harness(['rest', 'deny'])
    await gate.ask(request, false)
    await expect(gate.ask(request, true)).resolves.toBe(false)
    expect(approve).toHaveBeenCalledTimes(2)
  })

  it('should reject a pending card with AgentAbortedError on abort', async () => {
    const { gate } = harness([])
    const pending = gate.ask(request, false)
    gate.abort()
    await expect(pending).rejects.toBeInstanceOf(AgentAbortedError)
  })

  it('should refuse to ask once the signal is aborted', async () => {
    const { gate, controller, approve } = harness(['approve'])
    controller.abort()
    await expect(gate.ask(request, false)).rejects.toBeInstanceOf(AgentAbortedError)
    expect(approve).not.toHaveBeenCalled()
  })

  it('should refuse to auto-approve after "rest" once the signal is aborted', async () => {
    const { gate, controller, approve } = harness(['rest'])
    await gate.ask(request, false)
    controller.abort()
    await expect(gate.ask(request, false)).rejects.toBeInstanceOf(AgentAbortedError)
    expect(approve).toHaveBeenCalledTimes(1)
  })

  it('should announce that it is waiting for the user only when a card is shown', async () => {
    const { gate, events } = harness(['rest'])
    await gate.ask(request, false)
    expect(events).toEqual([{ type: 'status', state: 'waiting', label: '' }])
    await gate.ask(request, false)
    expect(events).toHaveLength(1)
  })
})
