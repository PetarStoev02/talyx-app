import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useApprovals } from '../../../src/renderer/src/features/bots/approvals'
import { MCP_APPROVAL_TIMEOUT_MS, MCP_CALL_TIMEOUT_MS } from '../../../src/shared/mcp'

const DELETE = { tool: 'delete_bot' as const, action: 'Delete the bot “Analyst”.' }

beforeEach(() => {
  vi.useFakeTimers()
  useApprovals.setState({ queue: [] })
})
afterEach(() => vi.useRealTimers())

describe('approvals', () => {
  it('should answer requests in the order they were asked', async () => {
    const first = useApprovals.getState().ask(DELETE)
    const second = useApprovals.getState().ask({ ...DELETE, action: 'Second' })
    useApprovals.getState().answer(true)
    useApprovals.getState().answer(false)
    expect([await first, await second]).toEqual([true, false])
    expect(useApprovals.getState().queue).toEqual([])
  })

  it('should count an unanswered request as a no before the agent’s call is dropped', async () => {
    expect(MCP_APPROVAL_TIMEOUT_MS).toBeLessThan(MCP_CALL_TIMEOUT_MS)
    const asked = useApprovals.getState().ask(DELETE)
    vi.advanceTimersByTime(MCP_APPROVAL_TIMEOUT_MS)
    expect(await asked).toBe(false)
    expect(useApprovals.getState().queue).toEqual([])
  })

  it('should ignore a late Allow once the request timed out', async () => {
    const asked = useApprovals.getState().ask(DELETE)
    vi.advanceTimersByTime(MCP_APPROVAL_TIMEOUT_MS)
    useApprovals.getState().answer(true)
    expect(await asked).toBe(false)
  })
})
