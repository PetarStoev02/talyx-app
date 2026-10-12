import { describe, it, expect, vi, type Mock } from 'vitest'
import { z } from 'zod/v4'
import {
  AgentSession,
  type ApprovalDecision,
  type ActionLogEntry,
  type AgentEvent
} from '../../../src/main/domain/agent/AgentSession'
import type {
  AssistantReply,
  ConversationMessage,
  ModelProvider,
  ToolDefinition
} from '../../../src/main/domain/agent/ModelProvider'
import { CapabilityRegistry } from '../../../src/main/domain/instruction/model/CapabilityRegistry'
import type { Capability, Operation } from '../../../src/main/domain/instruction/model/Capability'
import type { ConversationEntry } from '../../../src/main/domain/conversation/model/Conversation'
import {
  AgentAbortedError,
  IterationLimitError,
  ReadOnlyProposedChangeError,
  ReplyTruncatedError
} from '../../../src/main/domain/agent/errors'

// --- fakes ---------------------------------------------------------------

function reply(partial: Partial<AssistantReply>): AssistantReply {
  return {
    text: '',
    toolCalls: [],
    stopReason: 'end_turn',
    refusalExplanation: null,
    raw: null,
    ...partial
  }
}

class ScriptedProvider implements ModelProvider {
  readonly received: ConversationMessage[][] = []
  readonly tools: ToolDefinition[][] = []
  constructor(private readonly replies: AssistantReply[]) {}
  async complete(
    messages: ConversationMessage[],
    tools: ToolDefinition[]
  ): Promise<AssistantReply> {
    this.received.push(structuredClone(messages))
    this.tools.push(tools)
    const next = this.replies.shift()
    if (!next) throw new Error('script exhausted')
    return next
  }
}

const executed: Operation[] = []
const screenLook: Capability<Record<string, never>> = {
  name: 'look',
  description: 'look at the screen',
  examples: ['look'],
  params: z.object({}),
  effect: { world: 'reads', reversible: false, discloses: 'content' },
  async plan() {
    return {
      kind: 'answer',
      summary: 'screen',
      evidence: [],
      image: { mediaType: 'image/jpeg', base64: 'AAAA' }
    }
  }
}
const readOnly: Capability<{ q: string }> = {
  name: 'lookup',
  description: 'look something up',
  examples: ['look up x'],
  params: z.object({ q: z.string() }),
  effect: { world: 'reads', reversible: false, discloses: 'nothing' },
  async plan({ q }) {
    return { kind: 'answer', summary: `found ${q}`, evidence: [{ text: 'snippet', source: '/a' }] }
  }
}
const withCard: Capability<Record<string, never>> = {
  name: 'disk',
  description: 'disk',
  examples: [],
  params: z.object({}),
  effect: { world: 'reads', reversible: false, discloses: 'nothing' },
  async plan() {
    return {
      kind: 'answer',
      summary: '1 GB free of 2 GB',
      evidence: [],
      card: { kind: 'disk', freeBytes: 1, totalBytes: 2 }
    }
  }
}
const mutating: Capability<{ n: number }> = {
  name: 'change',
  description: 'change n things',
  examples: ['change 2 things'],
  params: z.object({ n: z.number().int().min(1) }),
  effect: { world: 'mutates', reversible: true, discloses: 'nothing' },
  async plan({ n }) {
    const operations = Array.from({ length: n }, (_, i) => ({
      label: `op ${i}`,
      reason: 'because',
      payload: { i },
      inverse: { i, undo: true }
    }))
    return { kind: 'plan', summary: `change ${n}`, operations }
  },
  async execute(op) {
    if ((op.payload as { i: number }).i === 99) throw new Error('boom')
    executed.push(op)
    return `did ${op.label}`
  },
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async revert() {}
}
const runInRepo: Capability<{ command: string }> = {
  name: 'run_in_repo',
  description: 'run',
  examples: ['run x'],
  params: z.object({ command: z.string() }),
  effect: { world: 'mutates', reversible: false, discloses: 'nothing' },
  async plan({ command }) {
    return {
      kind: 'plan',
      summary: command,
      operations: [
        { label: `$ ${command}`, reason: '', payload: { command, cwd: '/r' }, inverse: null }
      ]
    }
  },
  async execute() {
    return 'ok'
  }
}
const broken: Capability<Record<string, never>> = {
  name: 'broken',
  description: 'fails to plan',
  examples: [],
  params: z.object({}),
  effect: { world: 'reads', reversible: false, discloses: 'nothing' },
  async plan(): Promise<never> {
    throw new Error('no such folder')
  }
}
const badReadOnly: Capability<Record<string, never>> = {
  name: 'sneaky',
  description: 'claims to read',
  examples: [],
  params: z.object({}),
  effect: { world: 'reads', reversible: false, discloses: 'nothing' },
  async plan() {
    return {
      kind: 'plan',
      summary: 'oops',
      operations: [{ label: 'x', reason: '', payload: {}, inverse: null }]
    }
  }
}

function harness(
  replies: AssistantReply[],
  decisions: ApprovalDecision[] = ['approve']
): {
  session: AgentSession
  provider: ScriptedProvider
  ui: { approve: Mock; hide: Mock }
  approveCalls: { text: string; labels: string[] }[]
  log: ActionLogEntry[]
  events: AgentEvent[]
  readonly rejectPending: ((e: Error) => void) | null
} {
  executed.length = 0
  const provider = new ScriptedProvider(replies)
  const registry = new CapabilityRegistry([
    readOnly as Capability,
    screenLook as Capability,
    withCard as Capability,
    mutating as Capability,
    runInRepo as Capability,
    badReadOnly as Capability,
    broken as Capability
  ])
  const approveCalls: { text: string; labels: string[] }[] = []
  let rejectPending: ((e: Error) => void) | null = null
  const ui = {
    approve: vi.fn(async (req) => {
      approveCalls.push({
        text: req.text,
        labels: req.proposals.flatMap((p) => p.operations.map((o) => o.label))
      })
      const d = decisions.shift()
      if (d === undefined)
        return new Promise<ApprovalDecision>((_, reject) => {
          rejectPending = reject
        })
      return d
    }),
    hide: vi.fn()
  }
  const log: ActionLogEntry[] = []
  const events: AgentEvent[] = []
  const session = new AgentSession(
    provider,
    registry,
    ui,
    { append: (e) => log.push(e) },
    (e) => events.push(e),
    {
      sessionId: 's1',
      home: '/h',
      projectsRoot: '/h/Code'
    }
  )
  return {
    session,
    provider,
    ui,
    approveCalls,
    log,
    events,
    get rejectPending() {
      return rejectPending
    }
  }
}

function toolResultsOf(
  messages: ConversationMessage[]
): { toolUseId: string; text: string; isError: boolean }[] {
  const last = messages[messages.length - 1]
  return last.role === 'user' && 'results' in last ? last.results : []
}

function nonStatus(events: AgentEvent[]): AgentEvent[] {
  return events.filter((e) => e.type !== 'status')
}

// --- tests ---------------------------------------------------------------

describe('AgentSession', () => {
  it('should emit the text of a tool_use reply as interim narration', async () => {
    const h = harness([
      reply({
        text: 'Let me look that up.',
        stopReason: 'tool_use',
        toolCalls: [{ id: 'a', name: 'lookup', input: { q: 'x' } }]
      }),
      reply({ text: 'told you' })
    ])
    await h.session.run('look up x')
    expect(h.events.filter((e) => e.type === 'text')).toEqual([
      { type: 'text', text: 'Let me look that up.', interim: true },
      { type: 'text', text: 'told you', interim: false }
    ])
  })

  it('should emit an answer card before the reply that explains it', async () => {
    const h = harness([
      reply({ stopReason: 'tool_use', toolCalls: [{ id: 'a', name: 'disk', input: {} }] }),
      reply({ text: 'Plenty of room.' })
    ])
    await h.session.run('disk?')
    const kinds = h.events.filter((e) => e.type === 'card' || e.type === 'text').map((e) => e.type)
    expect(kinds).toEqual(['card', 'text'])
    expect(h.events.find((e) => e.type === 'card')).toEqual({
      type: 'card',
      card: { kind: 'disk', freeBytes: 1, totalBytes: 2 }
    })
  })

  it('should report what it is doing as status events', async () => {
    const h = harness([
      reply({
        stopReason: 'tool_use',
        toolCalls: [{ id: 'a', name: 'lookup', input: { q: 'x' } }]
      }),
      reply({ text: 'told you' })
    ])
    await h.session.run('look up x')
    expect(h.events.filter((e) => e.type === 'status')).toEqual([
      { type: 'status', state: 'thinking', label: '' },
      { type: 'status', state: 'working', label: 'Using lookup' },
      { type: 'status', state: 'thinking', label: '' }
    ])
  })

  it('should report waiting for the user while the card is up', async () => {
    const h = harness(
      [
        reply({
          stopReason: 'tool_use',
          toolCalls: [{ id: 'a', name: 'change', input: { n: 1 } }]
        }),
        reply({ text: 'ok' })
      ],
      ['approve']
    )
    await h.session.run('change one thing')
    const states = h.events.filter((e) => e.type === 'status').map((e) => e.state)
    expect(states).toEqual(['thinking', 'working', 'waiting', 'thinking'])
  })

  it('should emit the text and finish on end_turn with no tool calls', async () => {
    const h = harness([reply({ text: 'hello', stopReason: 'end_turn' })])
    await h.session.run('hi')
    expect(nonStatus(h.events)).toEqual([
      { type: 'text', text: 'hello', interim: false },
      { type: 'done' }
    ])
    expect(h.provider.tools[0].map((t) => t.name)).toEqual([
      'lookup',
      'look',
      'disk',
      'change',
      'run_in_repo',
      'sneaky',
      'broken'
    ])
  })

  it('should answer a read-only call without asking', async () => {
    const h = harness([
      reply({
        stopReason: 'tool_use',
        toolCalls: [{ id: 't1', name: 'lookup', input: { q: 'x' } }]
      }),
      reply({ text: 'done', stopReason: 'end_turn' })
    ])
    await h.session.run('look up x')
    expect(h.ui.approve).not.toHaveBeenCalled()
    expect(toolResultsOf(h.provider.received[1])).toEqual([
      { toolUseId: 't1', text: 'found x\n/a: snippet', isError: false }
    ])
  })

  it('should keep only the newest screenshot in the transcript', async () => {
    const look = (id: string): AssistantReply =>
      reply({ stopReason: 'tool_use', toolCalls: [{ id, name: 'look', input: {} }] })
    const h = harness([look('t1'), look('t2'), reply({ text: 'done', stopReason: 'end_turn' })])
    await h.session.run('what is on screen')
    const screenshotsSeen = (turn: number): (string | undefined)[] =>
      h.provider.received[turn]
        .filter((m) => 'results' in m)
        .map((m) => ('results' in m ? m.results[0].image?.base64 : undefined))
    expect(screenshotsSeen(1)).toEqual(['AAAA'])
    expect(screenshotsSeen(2)).toEqual([undefined, 'AAAA'])
  })

  it('should answer a capability whose plan throws as an error result and keep going', async () => {
    const h = harness([
      reply({ stopReason: 'tool_use', toolCalls: [{ id: 't1', name: 'broken', input: {} }] }),
      reply({ text: 'told you', stopReason: 'end_turn' })
    ])
    await h.session.run('x')
    expect(toolResultsOf(h.provider.received[1])).toEqual([
      { toolUseId: 't1', text: 'no such folder', isError: true }
    ])
    expect(nonStatus(h.events)).toEqual([
      { type: 'text', text: 'told you', interim: false },
      { type: 'done' }
    ])
  })

  it('should show one card listing every operation and execute on approve', async () => {
    const h = harness([
      reply({
        text: 'I will change two',
        stopReason: 'tool_use',
        toolCalls: [{ id: 't1', name: 'change', input: { n: 2 } }]
      }),
      reply({ text: 'ok', stopReason: 'end_turn' })
    ])
    await h.session.run('change 2')
    expect(h.approveCalls).toEqual([{ text: 'I will change two', labels: ['op 0', 'op 1'] }])
    expect(executed.map((o) => o.label)).toEqual(['op 0', 'op 1'])
    expect(toolResultsOf(h.provider.received[1])[0].text).toBe('Done: change 2\ndid op 0\ndid op 1')
    expect(h.log.map((e) => [e.label, e.ok, e.inverse])).toEqual([
      ['op 0', true, { i: 0, undo: true }],
      ['op 1', true, { i: 1, undo: true }]
    ])
    expect(h.ui.hide).toHaveBeenCalledTimes(1)
  })

  it('should answer "User declined" for every denied proposal and keep going', async () => {
    const h = harness(
      [
        reply({
          stopReason: 'tool_use',
          toolCalls: [
            { id: 't1', name: 'change', input: { n: 1 } },
            { id: 't2', name: 'change', input: { n: 1 } }
          ]
        }),
        reply({ text: 'fine', stopReason: 'end_turn' })
      ],
      ['deny']
    )
    await h.session.run('x')
    expect(executed).toHaveLength(0)
    expect(toolResultsOf(h.provider.received[1]).map((r) => r.text)).toEqual([
      'User declined',
      'User declined'
    ])
    expect(h.events.at(-1)).toEqual({ type: 'done' })
    expect(h.ui.hide).toHaveBeenCalledTimes(1)
  })

  it('should skip later cards after "rest"', async () => {
    const h = harness(
      [
        reply({
          stopReason: 'tool_use',
          toolCalls: [{ id: 't1', name: 'change', input: { n: 1 } }]
        }),
        reply({
          stopReason: 'tool_use',
          toolCalls: [{ id: 't2', name: 'change', input: { n: 1 } }]
        }),
        reply({ stopReason: 'end_turn' })
      ],
      ['rest']
    )
    await h.session.run('x')
    expect(h.ui.approve).toHaveBeenCalledTimes(1)
    expect(executed).toHaveLength(2)
  })

  it('should show the card again in the next task after "rest" in this one', async () => {
    const h = harness(
      [
        reply({
          stopReason: 'tool_use',
          toolCalls: [{ id: 't1', name: 'change', input: { n: 1 } }]
        }),
        reply({ stopReason: 'end_turn' }),
        reply({
          stopReason: 'tool_use',
          toolCalls: [{ id: 't2', name: 'change', input: { n: 1 } }]
        }),
        reply({ stopReason: 'end_turn' })
      ],
      ['rest', 'approve']
    )
    await h.session.run('first task')
    await h.session.run('second task')
    expect(h.ui.approve).toHaveBeenCalledTimes(2)
  })

  it('should still show the card after "rest" for a denylisted command', async () => {
    const h = harness(
      [
        reply({
          stopReason: 'tool_use',
          toolCalls: [{ id: 't1', name: 'change', input: { n: 1 } }]
        }),
        reply({
          stopReason: 'tool_use',
          toolCalls: [{ id: 't2', name: 'run_in_repo', input: { command: 'rm -rf dist' } }]
        }),
        reply({ stopReason: 'end_turn' })
      ],
      ['rest', 'approve']
    )
    await h.session.run('x')
    expect(h.ui.approve).toHaveBeenCalledTimes(2)
  })

  it('should return unknown tools and invalid params as error results, not exceptions', async () => {
    const h = harness([
      reply({
        stopReason: 'tool_use',
        toolCalls: [
          { id: 't1', name: 'nope', input: {} },
          { id: 't2', name: 'change', input: { n: 'two' } }
        ]
      }),
      reply({ stopReason: 'end_turn' })
    ])
    await h.session.run('x')
    const results = toolResultsOf(h.provider.received[1])
    expect(results[0]).toMatchObject({
      toolUseId: 't1',
      isError: true,
      text: 'Unknown tool "nope"'
    })
    expect(results[1].isError).toBe(true)
    expect(results[1].text).toContain('n')
    expect(h.ui.approve).not.toHaveBeenCalled()
  })

  it('should report a failing operation as k of n and keep the rest unexecuted', async () => {
    const h = harness([
      reply({
        stopReason: 'tool_use',
        toolCalls: [{ id: 't1', name: 'change', input: { n: 100 } }]
      }),
      reply({ stopReason: 'end_turn' })
    ])
    await h.session.run('x')
    const [result] = toolResultsOf(h.provider.received[1])
    expect(result.isError).toBe(true)
    expect(result.text).toBe('Failed at "op 99": boom. 99 of 100 operations completed.')
    expect(executed).toHaveLength(99)
    expect(h.log.filter((e) => !e.ok)).toHaveLength(1)
  })

  it('should throw ReadOnlyProposedChangeError when a reads capability proposes operations', async () => {
    const h = harness([
      reply({ stopReason: 'tool_use', toolCalls: [{ id: 't1', name: 'sneaky', input: {} }] })
    ])
    await expect(h.session.run('x')).rejects.toBeInstanceOf(ReadOnlyProposedChangeError)
  })

  it('should abort a pending approval and execute nothing', async () => {
    const h = harness(
      [
        reply({
          stopReason: 'tool_use',
          toolCalls: [{ id: 't1', name: 'change', input: { n: 1 } }]
        })
      ],
      []
    )
    const run = h.session.run('x')
    await vi.waitFor(() => expect(h.ui.approve).toHaveBeenCalled())
    h.session.abort()
    await expect(run).rejects.toBeInstanceOf(AgentAbortedError)
    expect(executed).toHaveLength(0)
  })

  it('should normalize an abort during the model request to AgentAbortedError', async () => {
    const provider: ModelProvider = {
      complete: (_messages, _tools, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        })
    }
    const registry = new CapabilityRegistry([readOnly as Capability])
    const session = new AgentSession(
      provider,
      registry,
      { approve: vi.fn(), hide: vi.fn() },
      { append: () => {} },
      () => {},
      { sessionId: 's', home: '/h', projectsRoot: '/h/Code' }
    )
    const run = session.run('x')
    session.abort()
    await expect(run).rejects.toBeInstanceOf(AgentAbortedError)
  })

  it('should refuse a second concurrent run while one is in progress', async () => {
    const h = harness(
      [
        reply({
          stopReason: 'tool_use',
          toolCalls: [{ id: 't1', name: 'change', input: { n: 1 } }]
        })
      ],
      []
    )
    const first = h.session.run('x')
    await vi.waitFor(() => expect(h.ui.approve).toHaveBeenCalled())
    await expect(h.session.run('y')).rejects.toThrow('AgentSession.run is already in progress')
    h.session.abort()
    await expect(first).rejects.toBeInstanceOf(AgentAbortedError)
  })

  it('should throw ReplyTruncatedError on max_tokens', async () => {
    const h = harness([reply({ stopReason: 'max_tokens' })])
    await expect(h.session.run('x')).rejects.toBeInstanceOf(ReplyTruncatedError)
  })

  it('should continue without a user message on pause_turn', async () => {
    const h = harness([
      reply({ stopReason: 'pause_turn' }),
      reply({ text: 'later', stopReason: 'end_turn' })
    ])
    await h.session.run('x')
    const second = h.provider.received[1]
    expect(second.at(-1)?.role).toBe('assistant')
    expect(nonStatus(h.events)[0]).toEqual({ type: 'text', text: 'later', interim: false })
  })

  it('should surface a refusal as an error event and finish', async () => {
    const h = harness([reply({ stopReason: 'refusal', refusalExplanation: 'no' })])
    await h.session.run('x')
    expect(nonStatus(h.events)).toEqual([
      { type: 'error', key: 'agent_refusal', message: 'no' },
      { type: 'done' }
    ])
  })

  it('should stop at the iteration limit', async () => {
    const loop = Array.from({ length: 3 }, () =>
      reply({ stopReason: 'tool_use', toolCalls: [{ id: 'l', name: 'lookup', input: { q: 'x' } }] })
    )
    const h = harness(loop)
    const session = new AgentSession(
      h.provider,
      new CapabilityRegistry([readOnly as Capability]),
      h.ui,
      { append: () => {} },
      () => {},
      {
        sessionId: 's',
        home: '/h',
        projectsRoot: '/h/Code',
        maxIterations: 3
      }
    )
    await expect(session.run('x')).rejects.toBeInstanceOf(IterationLimitError)
  })

  it('should answer every tool_use id exactly once on every path', async () => {
    const h = harness([
      reply({
        stopReason: 'tool_use',
        toolCalls: [
          { id: 'a', name: 'lookup', input: { q: 'x' } },
          { id: 'b', name: 'nope', input: {} },
          { id: 'c', name: 'change', input: { n: 1 } },
          { id: 'd', name: 'change', input: { n: 'bad' } }
        ]
      }),
      reply({ stopReason: 'end_turn' })
    ])
    await h.session.run('x')
    expect(toolResultsOf(h.provider.received[1]).map((r) => r.toolUseId)).toEqual([
      'a',
      'b',
      'c',
      'd'
    ])
  })

  it('should put an earlier conversation in front of the next instruction', async () => {
    const h = harness([reply({ text: 'ok', stopReason: 'end_turn' })])
    const earlier: ConversationEntry[] = [
      { kind: 'user', payload: { text: 'sort my downloads' } },
      { kind: 'assistant', payload: { text: 'Done, 12 files moved.', interim: false } }
    ]
    h.session.resume(earlier)
    await h.session.run('what about my desktop?')
    expect(JSON.stringify(h.provider.received[0])).toContain('Earlier in this conversation:')
  })

  it('should replay only once, not repeated in front of a later instruction', async () => {
    const h = harness([
      reply({ text: 'ok', stopReason: 'end_turn' }),
      reply({ text: 'ok', stopReason: 'end_turn' })
    ])
    const earlier: ConversationEntry[] = [{ kind: 'user', payload: { text: 'earlier thing' } }]
    h.session.resume(earlier)
    await h.session.run('first')
    await h.session.run('second')
    const occurrences =
      JSON.stringify(h.provider.received[1]).split('Earlier in this conversation:').length - 1
    expect(occurrences).toBe(1)
  })
})
