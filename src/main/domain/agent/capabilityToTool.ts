import { z } from 'zod/v4'
import type { Capability } from '../instruction/model/Capability'
import type { ToolDefinition } from './ModelProvider'

/**
 * The model sees the input side of the schema: `folder` params transform a
 * spoken name into a path and have no output schema at all.
 */
export function capabilityToTool(capability: Capability): ToolDefinition {
  const schema = z.toJSONSchema(capability.params, { io: 'input' }) as Record<string, unknown>
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { $schema, ...inputSchema } = schema
  return {
    name: capability.name,
    description: `${capability.description}\nExamples: ${capability.examples.join(' | ')}`,
    input_schema: { ...inputSchema, type: 'object' }
  }
}
