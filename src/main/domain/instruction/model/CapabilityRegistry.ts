import type { Capability } from './Capability'
import { IrreversibleCapabilityError, UnexecutableCapabilityError } from './errors'

/** The fixed vocabulary. Lookup only — never constructed from model output. */
export class CapabilityRegistry {
  private readonly byName: Map<string, Capability>

  constructor(capabilities: Capability[]) {
    for (const capability of capabilities) {
      const changesTheWorld = capability.effect.world !== 'reads'
      if (changesTheWorld && !capability.execute) {
        throw new UnexecutableCapabilityError(capability.name)
      }
      // A one-way capability is allowed; a one-way capability that pretends
      // otherwise is not.
      if (capability.effect.reversible && !capability.revert) {
        throw new IrreversibleCapabilityError(capability.name)
      }
    }
    this.byName = new Map(capabilities.map((c) => [c.name, c]))
  }

  get(name: string): Capability | null {
    return this.byName.get(name) ?? null
  }

  names(): string[] {
    return [...this.byName.keys()]
  }

  all(): Capability[] {
    return [...this.byName.values()]
  }

  /** The catalogue as the model sees it. */
  describeForPrompt(): string {
    return this.all()
      .map((c) => `- ${c.name}: ${c.description}\n  e.g. ${c.examples.join(' | ')}`)
      .join('\n')
  }
}
