import type { CapabilityContext, Proposal } from '../../instruction/model/Capability'
import type { CapabilityRegistry } from '../../instruction/model/CapabilityRegistry'

/**
 * Asks one read-only capability a question. Null when the ability is not
 * registered or could not answer — a briefing loses a line rather than failing.
 */
export type ReadCapability = (name: string, params: unknown) => Promise<Proposal | null>

/** Nothing that speaks first may change anything. */
export class NotReadOnlyError extends Error {
  readonly key = 'notice_capability_not_read_only'

  constructor(name: string) {
    super(`${name} changes the world, so a notice may not call it`)
    this.name = 'NotReadOnlyError'
  }
}

/**
 * The registry arrives as a getter because `brief_me` lives in the registry it
 * reads from — the same cycle `undo_last` already breaks this way.
 */
export function capabilityReader(
  registry: () => CapabilityRegistry,
  context: () => CapabilityContext
): ReadCapability {
  return async (name, params) => {
    const ctx = context()
    const capability = registry().get(name)
    if (capability === null) {
      ctx.logger.warn(`[notices] no capability called ${name}`)
      return null
    }
    if (capability.effect.world !== 'reads') throw new NotReadOnlyError(name)
    try {
      // Parsing first is what applies each parameter's defaults and folder
      // resolution, so a notice sees exactly what the model would have seen.
      return await capability.plan(capability.params.parse(params), ctx)
    } catch (err) {
      ctx.logger.warn(`[notices] ${name} could not answer: ${(err as Error).message}`)
      return null
    }
  }
}
