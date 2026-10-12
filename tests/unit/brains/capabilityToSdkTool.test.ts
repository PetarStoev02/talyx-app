import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod/v4'
import { capabilityToSdkTool } from '../../../src/main/infrastructure/brains/capabilityToSdkTool'
import { CapabilityDispatcher } from '../../../src/main/domain/agent/CapabilityDispatcher'
import { ApprovalGate } from '../../../src/main/domain/agent/ApprovalGate'
import { CapabilityRegistry } from '../../../src/main/domain/instruction/model/CapabilityRegistry'
import type { Capability, Operation } from '../../../src/main/domain/instruction/model/Capability'
import type {
  ActionLogEntry,
  AgentEvent,
  ApprovalDecision,
  ApprovalRequest
} from '../../../src/main/domain/agent/Brain'

// --- fakes ---------------------------------------------------------------

const executed: Operation[] = []
const plannedFolders: string[] = []

const readOnly: Capability<{ q: string }> = {
  name: 'lookup',
  description: 'look something up',
  examples: ['look up x', 'find x'],
  params: z.object({ q: z.string().describe('What to look up') }),
  effect: { world: 'reads', reversible: false, discloses: 'nothing' },
  async plan({ q }) {
    return { kind: 'answer', summary: `found ${q}`, evidence: [{ text: 'snippet', source: '/a' }] }
  }
}

const sortFolder: Capability<{ folder: string; mode: 'move' | 'copy' }> = {
  name: 'sort_folder',
  description: 'Organize a folder',
  examples: ['sort my downloads'],
  params: z.object({
    folder: z
      .string()
      .min(1)
      .transform((v) => `/resolved/${v}`)
      .describe('Folder to work on'),
    mode: z.enum(['move', 'copy']).default('move').describe('move or copy')
  }),
  effect: { world: 'mutates', reversible: true, discloses: 'nothing' },
  async plan({ folder, mode }) {
    plannedFolders.push(folder)
    return {
      kind: 'plan',
      summary: `${mode} files in ${folder}`,
      operations: [
        { label: `a.pdf → Docs`, reason: 'pdf', payload: { folder }, inverse: { undo: 1 } }
      ]
    }
  },
  async execute(op) {
    executed.push(op)
    return 'moved 1'
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

const screenLook: Capability<Record<string, never>> = {
  name: 'look',
  description: 'look at the screen',
  examples: ['what is on my screen'],
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

function harness(decisions: ApprovalDecision[]): {
  toolFor: (c: Capability) => ReturnType<typeof capabilityToSdkTool>
  approve: ReturnType<typeof vi.fn>
  requests: ApprovalRequest[]
  log: ActionLogEntry[]
  events: AgentEvent[]
  gate: ApprovalGate
} {
  const controller = new AbortController()
  const registry = new CapabilityRegistry([
    readOnly as Capability,
    screenLook as Capability,
    sortFolder as Capability,
    runInRepo as Capability
  ])
  const log: ActionLogEntry[] = []
  const events: AgentEvent[] = []
  const dispatcher = new CapabilityDispatcher({
    registry,
    ctx: {
      home: '/h',
      projectsRoot: '/h/Code',
      signal: controller.signal,
      logger: { info: () => {}, warn: () => {} }
    },
    log: { append: (e) => log.push(e) },
    emit: (e) => events.push(e),
    sessionId: 's1'
  })
  const requests: ApprovalRequest[] = []
  const approve = vi.fn(async (request: ApprovalRequest) => {
    requests.push(request)
    return decisions.shift() ?? 'deny'
  })
  const gate = new ApprovalGate({ approve, hide: () => {} }, controller.signal, (e) =>
    events.push(e)
  )
  return {
    toolFor: (c) => capabilityToSdkTool(c, dispatcher, gate),
    approve,
    requests,
    log,
    events,
    gate
  }
}

function textOf(result: { content: unknown[] }): string {
  const first = result.content[0] as { type: string; text: string }
  return first.text
}

beforeEach(() => {
  executed.length = 0
  plannedFolders.length = 0
})

function nonStatus(events: AgentEvent[]): AgentEvent[] {
  return events.filter((e) => e.type !== 'status')
}

// --- tests ---------------------------------------------------------------

describe('capabilityToSdkTool', () => {
  it('should keep the name, append examples, and expose the input side of the schema', () => {
    const { toolFor } = harness([])
    const def = toolFor(sortFolder as Capability)
    expect(def.name).toBe('sort_folder')
    expect(def.description).toBe('Organize a folder\nExamples: sort my downloads')
    const json = z.toJSONSchema(z.object(def.inputSchema), { io: 'input' }) as {
      properties: Record<string, Record<string, unknown>>
      required?: string[]
    }
    expect(json.properties.folder).toEqual({
      type: 'string',
      minLength: 1,
      description: 'Folder to work on'
    })
    expect(json.properties.mode).toMatchObject({ default: 'move', description: 'move or copy' })
    expect(json.required).toEqual(['folder'])
  })

  it('should answer a read-only ability without showing a card', async () => {
    const { toolFor, approve } = harness([])
    const result = await toolFor(readOnly as Capability).handler({ q: 'x' }, {})
    expect(textOf(result)).toBe('found x\n/a: snippet')
    expect(result.isError).toBe(false)
    expect(approve).not.toHaveBeenCalled()
  })

  it('should hand a screenshot to Claude Code as an image block', async () => {
    const { toolFor } = harness([])
    const result = await toolFor(screenLook as Capability).handler({}, {})
    expect(result.content).toEqual([
      { type: 'text', text: 'screen' },
      { type: 'image', data: 'AAAA', mimeType: 'image/jpeg' }
    ])
  })

  it('should still answer text when a plan rejects with something that is not an Error', async () => {
    const { toolFor } = harness([])
    const plan = vi.spyOn(screenLook, 'plan').mockRejectedValueOnce('denied')
    const result = await toolFor(screenLook as Capability).handler({}, {})
    plan.mockRestore()
    expect(result.isError).toBe(true)
    expect(textOf(result)).toBe('denied')
  })

  it('should return invalid parameters as an error result', async () => {
    const { toolFor } = harness([])
    const result = await toolFor(readOnly as Capability).handler({ q: 5 }, {})
    expect(result.isError).toBe(true)
    expect(textOf(result)).toMatch(/^Invalid parameters for lookup/)
  })

  it('should run the folder transform exactly once, in the dispatcher', async () => {
    const { toolFor } = harness(['approve'])
    await toolFor(sortFolder as Capability).handler({ folder: 'downloads' }, {})
    expect(plannedFolders).toEqual(['/resolved/downloads'])
  })

  it('should show one card for a plan and execute on approve', async () => {
    const { toolFor, requests, log, events } = harness(['approve'])
    const result = await toolFor(sortFolder as Capability).handler({ folder: 'd' }, {})
    expect(requests).toHaveLength(1)
    expect(requests[0].text).toBe('')
    expect(requests[0].proposals[0]).toMatchObject({
      tool: 'sort_folder',
      summary: 'move files in /resolved/d',
      reversible: true,
      operations: [{ label: 'a.pdf → Docs', reason: 'pdf' }]
    })
    expect(textOf(result)).toBe('Done: move files in /resolved/d\nmoved 1')
    expect(result.isError).toBe(false)
    expect(executed).toHaveLength(1)
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({ sessionId: 's1', tool: 'sort_folder', ok: true })
    expect(nonStatus(events)).toEqual([
      { type: 'action', label: 'a.pdf → Docs', ok: true, error: null }
    ])
  })

  it('should answer "User declined" and execute nothing on deny', async () => {
    const { toolFor, log } = harness(['deny'])
    const result = await toolFor(sortFolder as Capability).handler({ folder: 'd' }, {})
    expect(textOf(result)).toBe('User declined')
    expect(result.isError).toBe(false)
    expect(executed).toHaveLength(0)
    expect(log).toHaveLength(0)
  })

  it('should skip the card for later calls after "rest"', async () => {
    const { toolFor, approve } = harness(['rest'])
    const def = toolFor(sortFolder as Capability)
    await def.handler({ folder: 'a' }, {})
    await def.handler({ folder: 'b' }, {})
    expect(approve).toHaveBeenCalledTimes(1)
    expect(executed).toHaveLength(2)
  })

  it('should still show the card after "rest" for a denylisted command', async () => {
    const { toolFor, approve } = harness(['rest', 'deny'])
    const def = toolFor(runInRepo as Capability)
    await def.handler({ command: 'npm test' }, {})
    const result = await def.handler({ command: 'rm -rf dist' }, {})
    expect(approve).toHaveBeenCalledTimes(2)
    expect(textOf(result)).toBe('User declined')
  })
})
