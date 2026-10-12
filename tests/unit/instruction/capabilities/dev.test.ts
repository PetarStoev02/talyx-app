import { describe, it, expect, vi } from 'vitest'
import { CapabilityRegistry } from '../../../../src/main/domain/instruction/model/CapabilityRegistry'
import {
  devCapabilities,
  RUN_OUTPUT_CAP,
  type DevCapabilityDeps
} from '../../../../src/main/domain/instruction/capabilities/dev'
import type { CapabilityContext } from '../../../../src/main/domain/instruction/model/Capability'
import { AgentAbortedError, RepoOutsideRootError } from '../../../../src/main/domain/agent/errors'

const ctx: CapabilityContext = {
  home: '/Users/test',
  projectsRoot: '/Users/test/Code',
  signal: new AbortController().signal,
  logger: { info: () => {}, warn: () => {} }
}

function deps(overrides: Partial<DevCapabilityDeps> = {}): DevCapabilityDeps {
  return {
    listRepos: async () => ['talyx', 'tender-app'],
    realpath: async (p) => p,
    run: vi.fn(async () => ({ exitCode: 0, output: 'ok\n', timedOut: false, aborted: false })),
    ...overrides
  }
}

describe('list_repos', () => {
  it('should answer with one evidence line per repo', async () => {
    const cap = new CapabilityRegistry(devCapabilities(deps())).get('list_repos')!
    const proposal = await cap.plan({}, ctx)
    if (proposal.kind !== 'answer') throw new Error('expected answer')
    expect(proposal.summary).toBe('2 repositories in /Users/test/Code')
    expect(proposal.evidence).toEqual([
      { source: '/Users/test/Code/talyx', text: 'talyx' },
      { source: '/Users/test/Code/tender-app', text: 'tender-app' }
    ])
  })

  it('should attach a folder card the UI can open', async () => {
    const cap = new CapabilityRegistry(devCapabilities(deps())).get('list_repos')!
    const proposal = await cap.plan({}, ctx)
    if (proposal.kind !== 'answer') throw new Error('expected answer')
    expect(proposal.card).toEqual({
      kind: 'paths',
      entries: [
        { path: '/Users/test/Code/talyx', label: 'talyx', snippet: null, isDirectory: true },
        {
          path: '/Users/test/Code/tender-app',
          label: 'tender-app',
          snippet: null,
          isDirectory: true
        }
      ]
    })
  })
})

describe('run_in_repo', () => {
  it('should propose one labelled operation with the resolved cwd', async () => {
    const cap = new CapabilityRegistry(devCapabilities(deps())).get('run_in_repo')!
    const proposal = await cap.plan(cap.params.parse({ repo: 'talyx', command: 'npm test' }), ctx)
    if (proposal.kind !== 'plan') throw new Error('expected plan')
    expect(proposal.operations).toEqual([
      {
        label: '$ npm test  in /Users/test/Code/talyx',
        reason: 'run in talyx',
        payload: { command: 'npm test', cwd: '/Users/test/Code/talyx' },
        inverse: null
      }
    ])
  })

  it('should reject a repo that resolves outside the projects root', async () => {
    const d = deps({ realpath: async (p) => (p.includes('..') ? '/etc' : p) })
    const cap = new CapabilityRegistry(devCapabilities(d)).get('run_in_repo')!
    await expect(
      cap.plan(cap.params.parse({ repo: '../../etc', command: 'ls' }), ctx)
    ).rejects.toBeInstanceOf(RepoOutsideRootError)
  })

  it('should allow repos in symlinked projects root', async () => {
    const d = deps({
      realpath: async (p) => p.replace('/Users/test/Code', '/Volumes/real/Code')
    })
    const cap = new CapabilityRegistry(devCapabilities(d)).get('run_in_repo')!
    const proposal = await cap.plan(cap.params.parse({ repo: 'talyx', command: 'npm test' }), ctx)
    if (proposal.kind !== 'plan') throw new Error('expected plan')
    expect(proposal.operations[0]!.payload).toEqual({
      command: 'npm test',
      cwd: '/Volumes/real/Code/talyx'
    })
  })

  it('should return the exit code and output on execute', async () => {
    const d = deps()
    const cap = new CapabilityRegistry(devCapabilities(d)).get('run_in_repo')!
    const text = await cap.execute!(
      { label: '', reason: '', payload: { command: 'npm test', cwd: '/r' }, inverse: null },
      ctx
    )
    expect(d.run).toHaveBeenCalledWith('npm test', '/r', ctx.signal)
    expect(text).toBe('exit 0\nok\n')
  })

  it('should keep the tail when output exceeds the cap', async () => {
    const long = 'x'.repeat(RUN_OUTPUT_CAP + 10) + 'TAIL'
    const d = deps({
      run: async () => ({ exitCode: 1, output: long, timedOut: false, aborted: false })
    })
    const cap = new CapabilityRegistry(devCapabilities(d)).get('run_in_repo')!
    const text = (await cap.execute!(
      { label: '', reason: '', payload: { command: 'x', cwd: '/r' }, inverse: null },
      ctx
    )) as string
    expect(text.startsWith('exit 1\n[output truncated]\n')).toBe(true)
    expect(text.endsWith('TAIL')).toBe(true)
    expect(text.length).toBeLessThanOrEqual(RUN_OUTPUT_CAP + 'exit 1\n[output truncated]\n'.length)
  })

  it('should report a timeout with whatever the command managed to print', async () => {
    const d = deps({
      run: async () => ({ exitCode: null, output: 'some output', timedOut: true, aborted: false })
    })
    const cap = new CapabilityRegistry(devCapabilities(d)).get('run_in_repo')!
    const text = await cap.execute!(
      { label: '', reason: '', payload: { command: 'sleep 99', cwd: '/r' }, inverse: null },
      ctx
    )
    expect(text).toBe('timed out after 60s\nsome output')
  })

  it('should throw AgentAbortedError when the run ended because the session aborted', async () => {
    const d = deps({
      run: async () => ({ exitCode: null, output: 'partial', timedOut: false, aborted: true })
    })
    const cap = new CapabilityRegistry(devCapabilities(d)).get('run_in_repo')!
    await expect(
      cap.execute!(
        { label: '', reason: '', payload: { command: 'sleep 99', cwd: '/r' }, inverse: null },
        ctx
      )
    ).rejects.toBeInstanceOf(AgentAbortedError)
  })

  it('should register as an irreversible mutation', () => {
    const cap = new CapabilityRegistry(devCapabilities(deps())).get('run_in_repo')!
    expect(cap.effect).toEqual({ world: 'mutates', reversible: false, discloses: 'content' })
    expect(cap.revert).toBeUndefined()
  })
})
