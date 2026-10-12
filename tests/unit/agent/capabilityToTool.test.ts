import { describe, it, expect } from 'vitest'
import { z } from 'zod/v4'
import { capabilityToTool } from '../../../src/main/domain/agent/capabilityToTool'
import type { Capability } from '../../../src/main/domain/instruction/model/Capability'

const withTransform: Capability<{ folder: string }> = {
  name: 'sort_folder',
  description: 'Organize the loose files in a folder',
  examples: ['sort my downloads', 'tidy up this folder'],
  params: z.object({
    folder: z
      .string()
      .transform((v) => `/resolved/${v}`)
      .describe('Folder to work on')
  }),
  effect: { world: 'mutates', reversible: true, discloses: 'nothing' },
  async plan() {
    return { kind: 'plan', summary: '', operations: [] }
  },
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async execute() {},
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async revert() {}
}

describe('capabilityToTool', () => {
  const tool = capabilityToTool(withTransform as Capability)

  it('should keep the name and append examples to the description', () => {
    expect(tool.name).toBe('sort_folder')
    expect(tool.description).toBe(
      'Organize the loose files in a folder\nExamples: sort my downloads | tidy up this folder'
    )
  })

  it('should emit the input side of a transformed schema', () => {
    const props = tool.input_schema.properties as Record<
      string,
      { type: string; description: string }
    >
    expect(tool.input_schema.type).toBe('object')
    expect(props.folder.type).toBe('string')
    expect(props.folder.description).toBe('Folder to work on')
    expect(tool.input_schema.required).toEqual(['folder'])
  })
})
