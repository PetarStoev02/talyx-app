import { tmpdir } from 'os'
import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod/v4'
import type { ModelInfo, Options, SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import {
  ClaudeCodeBrain,
  isSignInFailure,
  readClaudeCodeModels,
  testClaudeCodeSignIn,
  type CatalogQueryFn,
  type QueryFn
} from '../../../src/main/infrastructure/brains/ClaudeCodeBrain'
import { CapabilityRegistry } from '../../../src/main/domain/instruction/model/CapabilityRegistry'
import type { Capability } from '../../../src/main/domain/instruction/model/Capability'
import type { ConversationEntry } from '../../../src/main/domain/conversation/model/Conversation'
import type {
  ActionLogEntry,
  AgentEvent,
  ApprovalDecision
} from '../../../src/main/domain/agent/Brain'
import {
  AgentAbortedError,
  BrainFailedError,
  ClaudeCodeNotSignedInError,
  IterationLimitError
} from '../../../src/main/domain/agent/errors'

// --- SDK message builders --------------------------------------------------

function init(sessionId: string): SDKMessage {
  return { type: 'system', subtype: 'init', session_id: sessionId } as unknown as SDKMessage
}
function assistantToolUse(name: string, input: Record<string, unknown>): SDKMessage {
  return {
    type: 'assistant',
    parent_tool_use_id: null,
    message: { role: 'assistant', content: [{ type: 'tool_use', id: 'tu-1', name, input }] }
  } as unknown as SDKMessage
}
function assistantNarrationThenTool(
  text: string,
  name: string,
  input: Record<string, unknown>
): SDKMessage {
  return {
    type: 'assistant',
    parent_tool_use_id: null,
    message: {
      role: 'assistant',
      content: [
        { type: 'text', text },
        { type: 'tool_use', id: 'tu-1', name, input }
      ]
    }
  } as unknown as SDKMessage
}
function assistantText(text: string, parentToolUseId: string | null = null): SDKMessage {
  return {
    type: 'assistant',
    parent_tool_use_id: parentToolUseId,
    message: { role: 'assistant', content: [{ type: 'text', text }] }
  } as unknown as SDKMessage
}
function success(result = 'done', isError = false): SDKMessage {
  return {
    type: 'result',
    subtype: 'success',
    is_error: isError,
    result,
    errors: []
  } as unknown as SDKMessage
}
function errorResult(subtype: string, errors: string[] = []): SDKMessage {
  return { type: 'result', subtype, is_error: true, errors } as unknown as SDKMessage
}
function authStatus(error: string | undefined, isAuthenticating = false): SDKMessage {
  return { type: 'auth_status', isAuthenticating, output: [], error } as unknown as SDKMessage
}
function toolResult(toolUseId: string, isError = false, text = 'ok'): SDKMessage {
  return {
    type: 'user',
    parent_tool_use_id: null,
    message: {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: toolUseId,
          is_error: isError,
          content: [{ type: 'text', text }]
        }
      ]
    }
  } as unknown as SDKMessage
}

/** A script is a list of messages, or a function that may drive canUseTool before yielding. */
type Script = SDKMessage[] | ((options: Options) => AsyncGenerator<SDKMessage>)

function scriptedQuery(scripts: Script[]): {
  queryFn: QueryFn
  calls: { prompt: string; options: Options }[]
} {
  const calls: { prompt: string; options: Options }[] = []
  const queryFn: QueryFn = ({ prompt, options }) => {
    calls.push({ prompt, options: options! })
    const script = scripts.shift()
    if (!script) throw new Error('script exhausted')
    if (typeof script === 'function') return script(options!)
    return (async function* () {
      for (const m of script) yield m
    })()
  }
  return { queryFn, calls }
}

/** Never yields; rejects when the abort controller fires, like the real SDK. */
// eslint-disable-next-line require-yield
async function* hangUntilAborted(options: Options): AsyncGenerator<SDKMessage> {
  await new Promise((_, reject) =>
    options.abortController!.signal.addEventListener('abort', () => reject(new Error('aborted')))
  )
}

function nonStatus(events: AgentEvent[]): AgentEvent[] {
  return events.filter((e) => e.type !== 'status')
}

// --- harness ----------------------------------------------------------------

/** Spawning needs a folder that is really there, so the tests use one. */
const REAL_FOLDER = tmpdir()

const readOnly: Capability<{ q: string }> = {
  name: 'lookup',
  description: 'look up',
  examples: ['look up x'],
  params: z.object({ q: z.string() }),
  effect: { world: 'reads', reversible: false, discloses: 'nothing' },
  async plan({ q }) {
    return { kind: 'answer', summary: `found ${q}`, evidence: [] }
  }
}

function harness(
  scripts: Script[],
  decisions: ApprovalDecision[] = [],
  model?: () => string,
  projectsRoot: string = REAL_FOLDER
): {
  brain: ClaudeCodeBrain
  calls: { prompt: string; options: Options }[]
  events: AgentEvent[]
  log: ActionLogEntry[]
  approve: ReturnType<typeof vi.fn>
  hide: ReturnType<typeof vi.fn>
} {
  const { queryFn, calls } = scriptedQuery(scripts)
  const events: AgentEvent[] = []
  const log: ActionLogEntry[] = []
  const approve = vi.fn(async () => {
    const next = decisions.shift()
    if (next === undefined) return new Promise<ApprovalDecision>(() => {})
    return next
  })
  const hide = vi.fn()
  const brain = new ClaudeCodeBrain({
    registry: new CapabilityRegistry([readOnly as Capability]),
    ui: { approve, hide },
    log: { append: (e) => log.push(e) },
    emit: (e) => events.push(e),
    options: {
      sessionId: 'talyx-1',
      home: '/h',
      projectsRoot,
      claudeCodePath: '/opt/homebrew/bin/claude',
      model
    },
    queryFn
  })
  return { brain, calls, events, log, approve, hide }
}

// --- tests ------------------------------------------------------------------

describe('ClaudeCodeBrain', () => {
  it('should pass the fixed SDK options and the Talyx MCP server', async () => {
    const { brain, calls } = harness([[init('s1'), success()]])
    await brain.run('hello')
    const options = calls[0].options
    expect(calls[0].prompt).toBe('hello')
    expect(options).toMatchObject({
      cwd: REAL_FOLDER,
      pathToClaudeCodeExecutable: '/opt/homebrew/bin/claude',
      permissionMode: 'default',
      settingSources: [],
      maxTurns: 40,
      includePartialMessages: false,
      disallowedTools: ['Task', 'KillShell']
    })
    expect(options.resume).toBeUndefined()
    expect(options.mcpServers?.talyx).toBeDefined()
    expect(typeof options.canUseTool).toBe('function')
    expect(options.systemPrompt).toMatchObject({ type: 'preset', preset: 'claude_code' })
    expect((options.systemPrompt as { append: string }).append).toContain('Talyx')
    expect(options.abortController).toBeInstanceOf(AbortController)
  })

  it('should start in the home folder when the owner has no projects folder', async () => {
    const { brain, calls } = harness(
      [[init('s1'), success()]],
      [],
      undefined,
      '/nowhere/this/does/not/exist'
    )
    await brain.run('hello')
    // A missing cwd kills the CLI before it starts, and its error blames the binary.
    expect(calls[0].options.cwd).toBe('/h')
  })

  it('should report what it is doing as status events', async () => {
    const { brain, events } = harness([
      [
        init('s1'),
        assistantToolUse('Bash', { command: 'npm test' }),
        toolResult('tu-1'),
        assistantText('done'),
        success()
      ]
    ])
    await brain.run('go')
    expect(events.filter((e) => e.type === 'status')).toEqual([
      { type: 'status', state: 'thinking', label: '' },
      { type: 'status', state: 'working', label: 'Running npm test' },
      { type: 'status', state: 'thinking', label: '' }
    ])
  })

  it('should mark narration that precedes a tool call as interim text', async () => {
    const { brain, events } = harness([
      [
        init('s1'),
        assistantNarrationThenTool("I'll load the repo listing tool.", 'Bash', { command: 'ls' }),
        toolResult('tu-1'),
        assistantText('Here they are'),
        success()
      ]
    ])
    await brain.run('go')
    expect(events.filter((e) => e.type === 'text')).toEqual([
      { type: 'text', text: "I'll load the repo listing tool.", interim: true },
      { type: 'text', text: 'Here they are', interim: false }
    ])
  })

  it('should mark text as interim when the tool call arrives in the next message', async () => {
    const { brain, events } = harness([
      [
        init('s1'),
        assistantText("I'll list your repos."),
        assistantToolUse('Bash', { command: 'ls' }),
        toolResult('tu-1'),
        assistantText('Here they are'),
        success()
      ]
    ])
    await brain.run('go')
    expect(events.filter((e) => e.type === 'text')).toEqual([
      { type: 'text', text: "I'll list your repos.", interim: true },
      { type: 'text', text: 'Here they are', interim: false }
    ])
    expect(events.at(-1)).toEqual({ type: 'done' })
  })

  it('should keep the overlay open when a run starts', async () => {
    const { brain, hide } = harness([[init('s1'), success()]])
    await brain.run('hi')
    expect(hide).not.toHaveBeenCalled()
  })

  it('should emit top-level assistant text and finish with done', async () => {
    const { brain, events } = harness([
      [
        init('s1'),
        assistantText('Working…'),
        assistantText('sub', 'tool-9'),
        assistantText('  '),
        success()
      ]
    ])
    await brain.run('go')
    expect(nonStatus(events)).toEqual([
      { type: 'text', text: 'Working…', interim: false },
      { type: 'done' }
    ])
  })

  it('should resume the Claude session on the next run', async () => {
    const { brain, calls } = harness([
      [init('sess-1'), success()],
      [init('sess-1'), success()]
    ])
    await brain.run('one')
    await brain.run('two')
    expect(calls[0].options.resume).toBeUndefined()
    expect(calls[1].options.resume).toBe('sess-1')
  })

  it('should throw IterationLimitError on error_max_turns and forget the session', async () => {
    const { brain, calls, events } = harness([
      [init('sess-1'), errorResult('error_max_turns')],
      [init('sess-2'), success()]
    ])
    await expect(brain.run('one')).rejects.toBeInstanceOf(IterationLimitError)
    expect(nonStatus(events)).toEqual([])
    await brain.run('two')
    expect(calls[1].options.resume).toBeUndefined()
  })

  it('should throw BrainFailedError with the SDK errors on other error results', async () => {
    const { brain } = harness([
      [init('s1'), errorResult('error_during_execution', ['boom', 'bang'])]
    ])
    const failure = brain.run('x')
    await expect(failure).rejects.toBeInstanceOf(BrainFailedError)
    await expect(failure).rejects.toMatchObject({
      key: 'agent_failed',
      subtype: 'error_during_execution',
      message: 'boom; bang'
    })
  })

  it('should recognise a signed-out Claude Code from the error text', async () => {
    const { brain } = harness([[init('s1'), success('Not logged in · Please run /login', true)]])
    await expect(brain.run('x')).rejects.toBeInstanceOf(ClaudeCodeNotSignedInError)
  })

  it('should recognise a signed-out Claude Code from an auth_status message', async () => {
    const { brain } = harness([[init('s1'), authStatus('Login required')]])
    await expect(brain.run('x')).rejects.toBeInstanceOf(ClaudeCodeNotSignedInError)
  })

  it('should fail when the stream ends without a result', async () => {
    const { brain } = harness([[init('s1'), assistantText('hm')]])
    await expect(brain.run('x')).rejects.toMatchObject({ subtype: 'no_result' })
  })

  it('should wrap an SDK launch error as BrainFailedError', async () => {
    const { brain } = harness([
      // eslint-disable-next-line require-yield
      async function* () {
        throw new Error('Claude Code executable at /x exists but failed to launch.')
      }
    ])
    await expect(brain.run('x')).rejects.toMatchObject({
      subtype: 'query_failed',
      message: 'Claude Code executable at /x exists but failed to launch.'
    })
  })

  it('should surface abort() as AgentAbortedError', async () => {
    const { brain } = harness([hangUntilAborted])
    const pending = brain.run('x')
    brain.abort()
    await expect(pending).rejects.toBeInstanceOf(AgentAbortedError)
  })

  it('should refuse a second concurrent run', async () => {
    const { brain } = harness([hangUntilAborted])
    const first = brain.run('x')
    await expect(brain.run('y')).rejects.toThrow(/already in progress/)
    brain.abort()
    await expect(first).rejects.toBeInstanceOf(AgentAbortedError)
  })

  describe('canUseTool', () => {
    async function captureCanUseTool(
      decisions: ApprovalDecision[]
    ): Promise<ReturnType<typeof harness> & { canUseTool: NonNullable<Options['canUseTool']> }> {
      const h = harness([[init('s1'), success()]], decisions)
      await h.brain.run('x')
      return { ...h, canUseTool: h.calls[0].options.canUseTool! }
    }
    const ctx = { signal: new AbortController().signal, toolUseID: 'tu-1' }

    it('should allow the auto class without a card', async () => {
      const { canUseTool, approve } = await captureCanUseTool([])
      await expect(canUseTool('Read', { file_path: '/a' }, ctx)).resolves.toEqual({
        behavior: 'allow',
        updatedInput: { file_path: '/a' }
      })
      await expect(canUseTool('mcp__talyx__lookup', { q: 'x' }, ctx)).resolves.toMatchObject({
        behavior: 'allow'
      })
      expect(approve).not.toHaveBeenCalled()
    })

    it('should deny the deny class outright', async () => {
      const { canUseTool, approve } = await captureCanUseTool([])
      await expect(canUseTool('Task', { prompt: 'p' }, ctx)).resolves.toEqual({
        behavior: 'deny',
        message: 'Not available in Talyx'
      })
      expect(approve).not.toHaveBeenCalled()
    })

    it('should show the card for Bash and deny when the user declines', async () => {
      const { canUseTool, approve, log } = await captureCanUseTool(['deny'])
      const result = await canUseTool('Bash', { command: 'npm test' }, ctx)
      expect(result).toEqual({ behavior: 'deny', message: 'User declined' })
      expect(approve).toHaveBeenCalledTimes(1)
      expect(approve.mock.calls[0][0]).toMatchObject({
        text: '',
        proposals: [
          {
            id: 'tu-1',
            tool: 'Bash',
            summary: 'Run a command',
            operations: [{ label: '$ npm test', reason: '' }]
          }
        ]
      })
      expect(log).toHaveLength(0)
    })

    it('should log an approved Bash call once its tool_result is observed', async () => {
      const { brain, events, log } = harness(
        [
          async function* (options) {
            const result = await options.canUseTool!('Bash', { command: 'npm test' }, ctx)
            expect(result).toEqual({ behavior: 'allow', updatedInput: { command: 'npm test' } })
            yield toolResult('tu-1')
            yield success()
          }
        ],
        ['approve']
      )
      await brain.run('x')
      expect(log).toEqual([
        {
          sessionId: 'talyx-1',
          proposalId: 'tu-1',
          tool: 'Bash',
          label: '$ npm test',
          payload: { command: 'npm test' },
          inverse: null,
          ok: true,
          error: null
        }
      ])
      expect(nonStatus(events)).toEqual([
        { type: 'action', label: '$ npm test', ok: true, error: null },
        { type: 'done' }
      ])
    })

    it('should log a failed built-in with its error text', async () => {
      const { brain, events, log } = harness(
        [
          async function* (options) {
            await options.canUseTool!('Bash', { command: 'npm test' }, ctx)
            yield toolResult('tu-1', true, 'exit code 1')
            yield success()
          }
        ],
        ['approve']
      )
      await brain.run('x')
      expect(log).toEqual([
        {
          sessionId: 'talyx-1',
          proposalId: 'tu-1',
          tool: 'Bash',
          label: '$ npm test',
          payload: { command: 'npm test' },
          inverse: null,
          ok: false,
          error: 'exit code 1'
        }
      ])
      expect(nonStatus(events)).toEqual([
        { type: 'action', label: '$ npm test', ok: false, error: 'exit code 1' },
        { type: 'done' }
      ])
    })

    it('should log an approved built-in that never returned as not observed', async () => {
      const { brain, log } = harness(
        [
          async function* (options) {
            await options.canUseTool!('Bash', { command: 'npm test' }, ctx)
            yield success()
          }
        ],
        ['approve']
      )
      await brain.run('x')
      expect(log).toEqual([
        {
          sessionId: 'talyx-1',
          proposalId: 'tu-1',
          tool: 'Bash',
          label: '$ npm test',
          payload: { command: 'npm test' },
          inverse: null,
          ok: false,
          error: 'No result observed'
        }
      ])
    })

    it('should skip the card after "rest" except for a denylisted command', async () => {
      const { canUseTool, approve } = await captureCanUseTool(['rest', 'deny'])
      await canUseTool('Edit', { file_path: '/a', old_string: 'x', new_string: 'y' }, ctx)
      await expect(canUseTool('Bash', { command: 'ls' }, ctx)).resolves.toMatchObject({
        behavior: 'allow'
      })
      await expect(canUseTool('Bash', { command: 'rm -rf dist' }, ctx)).resolves.toEqual({
        behavior: 'deny',
        message: 'User declined'
      })
      expect(approve).toHaveBeenCalledTimes(2)
    })

    it('should reset "rest" at the start of the next run', async () => {
      const h = harness(
        [
          [init('s1'), success()],
          [init('s1'), success()]
        ],
        ['rest', 'approve']
      )
      await h.brain.run('one')
      await h.calls[0].options.canUseTool!('Bash', { command: 'ls' }, ctx)
      await h.brain.run('two')
      await h.calls[1].options.canUseTool!('Bash', { command: 'ls' }, ctx)
      expect(h.approve).toHaveBeenCalledTimes(2)
    })

    it('should reject a pending card when the brain is aborted', async () => {
      const { brain, approve } = harness(
        [
          async function* (options) {
            await options.canUseTool!('Bash', { command: 'ls' }, ctx)
            yield success()
          }
        ],
        []
      )
      const pending = brain.run('x')
      await vi.waitFor(() => expect(approve).toHaveBeenCalled())
      brain.abort()
      await expect(pending).rejects.toBeInstanceOf(AgentAbortedError)
    })
  })

  it('should put an earlier conversation in front of the next instruction', async () => {
    const { brain, calls } = harness([[init('s1'), success()]])
    const earlier: ConversationEntry[] = [
      { kind: 'user', payload: { text: 'sort my downloads' } },
      { kind: 'assistant', payload: { text: 'Done, 12 files moved.', interim: false } }
    ]
    brain.resume(earlier)
    await brain.run('what about my desktop?')
    expect(calls[0].prompt).toContain('Earlier in this conversation:')
    expect(calls[0].prompt).toContain('You: sort my downloads')
    expect(calls[0].prompt).toContain('what about my desktop?')
    expect(calls[0].prompt.indexOf('Earlier')).toBeLessThan(
      calls[0].prompt.indexOf('what about my desktop?')
    )
  })

  it('should only replay once, not in front of every later instruction', async () => {
    const { brain, calls } = harness([
      [init('s1'), success()],
      [init('s1'), success()]
    ])
    const earlier: ConversationEntry[] = [{ kind: 'user', payload: { text: 'earlier thing' } }]
    brain.resume(earlier)
    await brain.run('first')
    await brain.run('second')
    expect(calls[1].prompt).toBe('second')
  })
})

describe('isSignInFailure', () => {
  it.each([
    ['Not logged in · Please run /login', true],
    ['Invalid API key · Please run /login', true],
    ['authentication_error: OAuth token expired', true],
    ['Command failed: npm test', false],
    ['Error building blog index', false],
    ['Analog input out of range', false],
    ['Design in Figma: dialog inline', false],
    ['', false]
  ])('should classify %j as %s', (text, expected) => {
    expect(isSignInFailure(text)).toBe(expected)
  })
})

describe('ClaudeCodeBrain model choice', () => {
  it('should leave the model to the CLI when none is chosen or the CLI default is', async () => {
    const none = harness([[init('s'), assistantText('hi'), success('hi')]])
    await none.brain.run('hello')
    expect(none.calls[0].options.model).toBeUndefined()

    const cliDefault = harness(
      [[init('s'), assistantText('hi'), success('hi')]],
      [],
      () => 'default'
    )
    await cliDefault.brain.run('hello')
    expect(cliDefault.calls[0].options.model).toBeUndefined()
  })

  it('should read the chosen model on every run, so a switch keeps the conversation', async () => {
    let chosen = 'sonnet'
    const h = harness(
      [
        [init('sess-1'), assistantText('a'), success('a')],
        [init('sess-1'), assistantText('b'), success('b')]
      ],
      [],
      () => chosen
    )
    await h.brain.run('one')
    chosen = 'opus[1m]'
    await h.brain.run('two')
    expect(h.calls.map((c) => c.options.model)).toEqual(['sonnet', 'opus[1m]'])
    expect(h.calls[1].options.resume).toBe('sess-1')
  })
})

describe('readClaudeCodeModels', () => {
  const catalog: ModelInfo[] = [
    { value: 'default', displayName: 'Default (recommended)', description: 'Opus' },
    {
      value: 'sonnet',
      resolvedModel: 'claude-sonnet-5',
      displayName: 'Sonnet',
      description: 'Fast'
    }
  ]

  it('should ask the binary for its catalog and close the process afterwards', async () => {
    const close = vi.fn()
    let signal: AbortSignal | undefined
    const queryFn: CatalogQueryFn = ({ options }) => {
      signal = options!.abortController!.signal
      return { supportedModels: async () => catalog, close }
    }
    const models = await readClaudeCodeModels({ claudeCodePath: '/bin/claude', cwd: '/h', queryFn })
    expect(models).toEqual([
      { id: 'default', label: 'Default (recommended)', description: 'Opus' },
      { id: 'sonnet', label: 'Sonnet', description: 'Fast' }
    ])
    expect(close).toHaveBeenCalledOnce()
    expect(signal!.aborted).toBe(true)
  })

  it('should close the process even when the catalog request fails', async () => {
    const close = vi.fn()
    const queryFn: CatalogQueryFn = () => ({
      supportedModels: () => Promise.reject(new Error('not signed in')),
      close
    })
    await expect(
      readClaudeCodeModels({ claudeCodePath: '/bin/claude', cwd: '/h', queryFn })
    ).rejects.toThrow('not signed in')
    expect(close).toHaveBeenCalledOnce()
  })
})

describe('testClaudeCodeSignIn', () => {
  function probe(script: Script): {
    run: Promise<void>
    calls: { prompt: string; options: Options }[]
  } {
    const { queryFn, calls } = scriptedQuery([script])
    return {
      run: testClaudeCodeSignIn({ claudeCodePath: '/bin/claude', cwd: '/h/Code', queryFn }),
      calls
    }
  }

  it('should resolve on a successful one-turn answer with a locked-down option set', async () => {
    const { run, calls } = probe([init('s'), assistantText('OK'), success('OK')])
    await expect(run).resolves.toBeUndefined()
    expect(calls[0].prompt).toBe('Reply with OK')
    expect(calls[0].options).toMatchObject({
      pathToClaudeCodeExecutable: '/bin/claude',
      cwd: '/h/Code',
      maxTurns: 1,
      tools: [],
      settingSources: [],
      permissionMode: 'default'
    })
  })

  it('should report a signed-out binary from the result text', async () => {
    const { run } = probe([init('s'), success('Please run /login', true)])
    await expect(run).rejects.toBeInstanceOf(ClaudeCodeNotSignedInError)
  })

  it('should report a signed-out binary when init never arrives', async () => {
    const { run } = probe([errorResult('error_during_execution', ['boot failed'])])
    await expect(run).rejects.toBeInstanceOf(ClaudeCodeNotSignedInError)
  })

  it('should report a signed-out binary from auth_status', async () => {
    const { run } = probe([authStatus(undefined, true)])
    await expect(run).rejects.toBeInstanceOf(ClaudeCodeNotSignedInError)
  })

  it('should report other failures after init as BrainFailedError', async () => {
    const { run } = probe([init('s'), errorResult('error_during_execution', ['boom'])])
    await expect(run).rejects.toMatchObject({ subtype: 'error_during_execution', message: 'boom' })
  })

  it('should wrap a launch failure as BrainFailedError', async () => {
    const { run } = probe(
      // eslint-disable-next-line require-yield
      async function* () {
        throw new Error('not found')
      }
    )
    await expect(run).rejects.toMatchObject({ subtype: 'launch_failed', message: 'not found' })
  })
})
