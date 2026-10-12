import { describe, it, expect } from 'vitest'
import { z } from 'zod/v4'
import { CapabilityRegistry } from '../../../src/main/domain/instruction/model/CapabilityRegistry'
import {
  IrreversibleCapabilityError,
  UnexecutableCapabilityError
} from '../../../src/main/domain/instruction/model/errors'
import type { Capability, Proposal } from '../../../src/main/domain/instruction/model/Capability'
import type { Effect } from '../../../src/main/domain/instruction/model/Effect'

function capability(name: string, effect: Effect, extras: Partial<Capability> = {}): Capability {
  return {
    name,
    description: `does ${name}`,
    examples: [`do ${name}`],
    params: z.object({}),
    effect,
    async plan(): Promise<Proposal> {
      return { kind: 'answer', summary: name, evidence: [] }
    },
    ...extras
  } as Capability
}

const reads: Effect = { reversible: false, world: 'reads', discloses: 'nothing' }
const creates: Effect = { reversible: true, world: 'creates', discloses: 'nothing' }
const mutates: Effect = { reversible: true, world: 'mutates', discloses: 'nothing' }

describe('CapabilityRegistry', () => {
  it('should accept a read-only capability with no executor', () => {
    const registry = new CapabilityRegistry([capability('look', reads)])

    expect(registry.names()).toEqual(['look'])
  })

  it.each([
    ['creates', creates],
    ['mutates', mutates]
  ])('should reject a %s capability that cannot be executed', (_label, effect) => {
    const noExecute = capability('act', effect, { revert: async () => {} })

    expect(() => new CapabilityRegistry([noExecute])).toThrow(UnexecutableCapabilityError)
  })

  it('should reject a capability that claims to be reversible but cannot revert', () => {
    const noRevert = capability('act', mutates, { execute: async () => {} })

    expect(() => new CapabilityRegistry([noRevert])).toThrow(IrreversibleCapabilityError)
  })

  it('should accept a one-way capability that declares itself irreversible', () => {
    // Trashing a file is genuinely one-way. Forcing it to fake an inverse would
    // put an Undo button on screen that cannot work — worse than no button.
    const oneWay = capability(
      'trash_it',
      { reversible: false, world: 'mutates', discloses: 'nothing' },
      { execute: async () => {} }
    )

    expect(() => new CapabilityRegistry([oneWay])).not.toThrow()
  })

  it('should accept a mutating capability that can both execute and revert', () => {
    const complete = capability('act', mutates, {
      execute: async () => {},
      revert: async () => {}
    })

    expect(() => new CapabilityRegistry([complete])).not.toThrow()
  })

  it('should name the offending capability in the failure', () => {
    expect(() => new CapabilityRegistry([capability('trash_everything', mutates)])).toThrow(
      /trash_everything/
    )
  })

  it('should describe every capability for the prompt with its examples', () => {
    const registry = new CapabilityRegistry([capability('look', reads)])

    expect(registry.describeForPrompt()).toBe('- look: does look\n  e.g. do look')
  })
})
