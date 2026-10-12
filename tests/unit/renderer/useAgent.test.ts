import { describe, it, expect } from 'vitest'
import {
  applyAgentEvent,
  initialAgentState,
  type AgentState
} from '../../../src/renderer/src/features/assistant/useAgent'

const request = {
  text: 'I will',
  proposals: [
    {
      id: 'p',
      tool: 'run_in_repo',
      summary: 's',
      reversible: false,
      operations: [{ label: '$ npm test', reason: '' }]
    }
  ]
}

describe('applyAgentEvent', () => {
  it('should enter approval on an approval event and leave it on done', () => {
    let s: AgentState = { ...initialAgentState, phase: 'working' }
    s = applyAgentEvent(s, { type: 'approval', request })
    expect(s.phase).toBe('approval')
    expect(s.approval).toEqual(request)
    s = applyAgentEvent(s, { type: 'text', text: 'ran it', interim: false })
    s = applyAgentEvent(s, { type: 'done' })
    expect(s.phase).toBe('done')
    expect(s.approval).toBeNull()
    expect(s.transcript.at(-1)).toEqual({ kind: 'assistant', text: 'ran it', interim: false })
  })

  it('should append actions and keep working', () => {
    const s = applyAgentEvent(
      { ...initialAgentState, phase: 'working' },
      { type: 'action', label: 'x', ok: false, error: 'boom' }
    )
    expect(s.phase).toBe('working')
    expect(s.transcript).toEqual([{ kind: 'action', label: 'x', ok: false, error: 'boom' }])
  })

  it('should record an error and end in the error phase', () => {
    let s = applyAgentEvent(
      { ...initialAgentState, phase: 'working' },
      { type: 'error', key: 'agent_provider_error', message: 'API key rejected' }
    )
    s = applyAgentEvent(s, { type: 'done' })
    expect(s.phase).toBe('error')
    expect(s.lastError).toEqual({ key: 'agent_provider_error', message: 'API key rejected' })
  })

  it('should not append an empty assistant text', () => {
    const s = applyAgentEvent(
      { ...initialAgentState, phase: 'working' },
      { type: 'text', text: '', interim: false }
    )
    expect(s.transcript).toEqual([])
  })
})

describe('applyAgentEvent status', () => {
  it('should keep the latest status while working and clear it on done', () => {
    let s: AgentState = { ...initialAgentState, phase: 'working' }
    s = applyAgentEvent(s, { type: 'status', state: 'thinking', label: '' })
    expect(s.status).toEqual({ state: 'thinking', label: '' })
    s = applyAgentEvent(s, { type: 'status', state: 'working', label: 'Running npm test' })
    expect(s.status).toEqual({ state: 'working', label: 'Running npm test' })
    expect(s.transcript).toEqual([])
    s = applyAgentEvent(s, { type: 'done' })
    expect(s.status).toBeNull()
  })

  it('should keep interim narration as a muted assistant entry', () => {
    const s = applyAgentEvent(
      { ...initialAgentState, phase: 'working' },
      { type: 'text', text: 'Let me check.', interim: true }
    )
    expect(s.transcript).toEqual([{ kind: 'assistant', text: 'Let me check.', interim: true }])
  })

  it('should append a result card as a transcript entry', () => {
    const card = { kind: 'disk' as const, freeBytes: 1, totalBytes: 2 }
    const s = applyAgentEvent({ ...initialAgentState, phase: 'working' }, { type: 'card', card })
    expect(s.transcript).toEqual([{ kind: 'card', card }])
  })
})
