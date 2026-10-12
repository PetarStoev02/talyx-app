import { describe, it, expect, vi } from 'vitest'
import { CapabilityRegistry } from '../../../../src/main/domain/instruction/model/CapabilityRegistry'
import {
  undoCapabilities,
  type UndoCapabilityDeps
} from '../../../../src/main/domain/instruction/capabilities/undo'
import type { CapabilityContext } from '../../../../src/main/domain/instruction/model/Capability'

const ctx: CapabilityContext = {
  home: '/Users/test',
  projectsRoot: '/Users/test/Code',
  signal: new AbortController().signal,
  logger: { info: () => {}, warn: () => {} }
}

const moved = {
  tool: 'sort_folder',
  label: 'a.pdf → Docs',
  payload: { kind: 'move', sourcePath: '/a.pdf', targetPath: '/Docs/a.pdf' },
  inverse: { kind: 'move', sourcePath: '/Docs/a.pdf', targetPath: '/a.pdf' }
}
const toggled = {
  tool: 'system_toggle',
  label: 'Turn dark mode on',
  payload: { setting: 'dark_mode', on: true },
  inverse: { setting: 'dark_mode', on: false }
}

function deps(rows: (typeof moved)[] | null = [moved, toggled]): UndoCapabilityDeps {
  return {
    latestUndoable: async () => rows,
    revert: vi.fn(async () => {}),
    redo: vi.fn(async () => {})
  }
}

describe('undo_last', () => {
  it('should propose one undo per operation of the last change, whatever tool did it', async () => {
    const d = deps()
    const cap = new CapabilityRegistry(undoCapabilities(d)).get('undo_last')!
    const proposal = await cap.plan({}, ctx)
    if (proposal.kind !== 'plan') throw new Error('expected plan')
    expect(proposal.summary).toBe('Undo 2 operations from the last change')
    expect(proposal.operations.map((o) => o.label)).toEqual([
      'Undo: a.pdf → Docs',
      'Undo: Turn dark mode on'
    ])
    expect(proposal.operations[1].payload).toEqual(toggled)
    expect(proposal.operations[1].inverse).toEqual(toggled)
  })

  it('should call the original tool to revert, and to redo when the undo is undone', async () => {
    const d = deps()
    const cap = new CapabilityRegistry(undoCapabilities(d)).get('undo_last')!
    const proposal = await cap.plan({}, ctx)
    if (proposal.kind !== 'plan') throw new Error('expected plan')
    await cap.execute!(proposal.operations[1], ctx)
    expect(d.revert).toHaveBeenCalledWith(
      'system_toggle',
      { label: toggled.label, reason: 'undo', payload: toggled.payload, inverse: toggled.inverse },
      ctx
    )
    await cap.revert!(proposal.operations[1], ctx)
    expect(d.redo).toHaveBeenCalledWith(
      'system_toggle',
      { label: toggled.label, reason: 'undo', payload: toggled.payload, inverse: toggled.inverse },
      ctx
    )
  })

  it('should say there is nothing to undo', async () => {
    const cap = new CapabilityRegistry(undoCapabilities(deps(null))).get('undo_last')!
    const proposal = await cap.plan({}, ctx)
    expect(proposal.kind === 'plan' && proposal.operations).toEqual([])
    expect(proposal.summary).toBe('There is nothing to undo')
  })

  it('should be a reversible mutation', () => {
    const cap = new CapabilityRegistry(undoCapabilities(deps())).get('undo_last')!
    expect(cap.effect).toEqual({ world: 'mutates', reversible: true, discloses: 'nothing' })
  })
})
