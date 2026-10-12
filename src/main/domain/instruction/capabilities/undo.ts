import { z } from 'zod/v4'
import type { Capability, CapabilityContext, Operation, Proposal } from '../model/Capability'
import type { Effect } from '../model/Effect'

/** One executed operation as the action log remembers it. */
export interface UndoneOperation {
  tool: string
  label: string
  payload: unknown
  inverse: unknown
}

export interface UndoCapabilityDeps {
  /** Operations of the most recent fully reversible proposal, in execution order. */
  latestUndoable(): Promise<UndoneOperation[] | null>
  /** Runs the `revert` of the capability that did `op`. */
  revert(tool: string, op: Operation, ctx: CapabilityContext): Promise<void>
  /** Runs that capability's `execute` again — undoing the undo. */
  redo(tool: string, op: Operation, ctx: CapabilityContext): Promise<void>
}

const REVERSIBLE_MUTATION: Effect = { reversible: true, world: 'mutates', discloses: 'nothing' }

/**
 * "Undo that" for anything reversible — a sort, a dark-mode toggle, a converted
 * file — routed back to the capability that did it. Each undo row carries the
 * original operation so the tool gets exactly what it produced.
 */
export function undoCapabilities(deps: UndoCapabilityDeps): Capability[] {
  const undoLast: Capability<Record<string, never>> = {
    name: 'undo_last',
    description: 'Take back the most recent change the assistant made',
    examples: ['undo that', 'put my files back', 'revert the last change'],
    params: z.object({}),
    effect: REVERSIBLE_MUTATION,
    async plan(): Promise<Proposal> {
      const previous = await deps.latestUndoable()
      if (!previous || previous.length === 0) {
        return { kind: 'plan', summary: 'There is nothing to undo', operations: [] }
      }
      return {
        kind: 'plan',
        summary: `Undo ${previous.length} operation${previous.length === 1 ? '' : 's'} from the last change`,
        operations: previous.map((done) => ({
          label: `Undo: ${done.label}`,
          reason: 'undo',
          payload: done,
          inverse: done
        }))
      }
    },
    async execute(op, ctx) {
      const done = op.payload as UndoneOperation
      await deps.revert(done.tool, original(done), ctx)
    },
    async revert(op, ctx) {
      const done = op.inverse as UndoneOperation
      await deps.redo(done.tool, original(done), ctx)
    }
  }

  return [undoLast as Capability]
}

function original(done: UndoneOperation): Operation {
  return { label: done.label, reason: 'undo', payload: done.payload, inverse: done.inverse }
}
