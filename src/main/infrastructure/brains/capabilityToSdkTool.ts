import { randomUUID } from 'crypto'
import { z } from 'zod/v4'
import { tool, type SdkMcpToolDefinition } from '@anthropic-ai/claude-agent-sdk'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { Capability } from '../../domain/instruction/model/Capability'
import type { CapabilityDispatcher } from '../../domain/agent/CapabilityDispatcher'
import type { ApprovalGate } from '../../domain/agent/ApprovalGate'
import type { ToolCall, ToolResult } from '../../domain/agent/ModelProvider'
import { needsCardDespiteRest } from '../../domain/agent/ApprovalPolicy'

export type TalyxSdkTool = SdkMcpToolDefinition<Record<string, z.ZodType>>

/**
 * One Talyx ability as a tool of the in-process `talyx` MCP server. The handler
 * runs the same dispatcher as the API-key brain; a plan with operations shows
 * its own card through the gate before anything executes.
 */
export function capabilityToSdkTool(
  capability: Capability,
  dispatcher: CapabilityDispatcher,
  gate: ApprovalGate
): TalyxSdkTool {
  return tool(
    capability.name,
    `${capability.description}\nExamples: ${capability.examples.join(' | ')}`,
    inputShape(capability),
    async (input: Record<string, unknown>): Promise<CallToolResult> => {
      const call: ToolCall = { id: randomUUID(), name: capability.name, input }
      const outcome = await dispatcher.dispatch(call)
      if (outcome.pending === null) return toCallToolResult(outcome.result)

      const forceCard = outcome.pending.proposal.operations.some((op) =>
        needsCardDespiteRest(capability.name, op.payload)
      )
      const proposal = dispatcher.toProposal(call, outcome.pending)
      const allowed = await gate.ask({ text: '', proposals: [proposal] }, forceCard)
      if (!allowed) return { content: [{ type: 'text', text: 'User declined' }], isError: false }
      return toCallToolResult(await dispatcher.execute(call.id, outcome.pending))
    }
  )
}

/**
 * The SDK's MCP server validates arguments with this shape before the handler
 * runs, and the dispatcher validates again with the real schema. A transform
 * (spoken folder name → path) must run only once, so the model and the MCP
 * layer see the input side; the dispatcher applies the transform.
 */
function inputShape(capability: Capability): Record<string, z.ZodType> {
  // Every capability's params is a z.object; the Capability type only promises ZodType.
  const params = capability.params as unknown as z.ZodObject
  return Object.fromEntries(
    Object.entries(params.shape).map(([key, schema]) => [key, inputSide(schema as z.ZodType)])
  )
}

function inputSide(schema: z.ZodType): z.ZodType {
  let stripped: z.ZodType
  if (schema instanceof z.ZodPipe) stripped = schema.in as z.ZodType
  else if (schema instanceof z.ZodOptional)
    stripped = inputSide(schema.unwrap() as z.ZodType).optional()
  else if (schema instanceof z.ZodNullable)
    stripped = inputSide(schema.unwrap() as z.ZodType).nullable()
  else if (schema instanceof z.ZodDefault)
    stripped = inputSide(schema.unwrap() as z.ZodType).default(schema.def.defaultValue as never)
  else return schema
  return schema.description ? stripped.describe(schema.description) : stripped
}

function toCallToolResult(result: ToolResult): CallToolResult {
  const text = { type: 'text' as const, text: result.text }
  const content = result.image
    ? [
        text,
        { type: 'image' as const, data: result.image.base64, mimeType: result.image.mediaType }
      ]
    : [text]
  return { content, isError: result.isError }
}
