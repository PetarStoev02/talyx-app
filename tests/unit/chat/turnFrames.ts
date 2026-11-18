import fc from 'fast-check'
import type { GatewayEvent } from '../../../src/renderer/src/shared/engine/shared'

// One part of a reply: streamed text in chunks, or a tool the bot ran.
type Part = { kind: 'text'; chunks: string[] } | { kind: 'tool' }

const part: fc.Arbitrary<Part> = fc.oneof(
  fc.record({
    kind: fc.constant('text' as const),
    chunks: fc.array(fc.string({ minLength: 1, maxLength: 6 }), { minLength: 1, maxLength: 4 })
  }),
  fc.constant({ kind: 'tool' as const })
)

/** The frames the gateway sends for a few bot turns in `sessionId`, in order, each with its seq. */
export function turnFrames(sessionId: string): fc.Arbitrary<GatewayEvent[]> {
  return fc
    .array(fc.array(part, { maxLength: 4 }), { minLength: 1, maxLength: 3 })
    .map((replies) => {
      const sent: Array<[string, Record<string, unknown>]> = []
      replies.forEach((parts, turn) => {
        const turnId = `turn-${turn}`
        sent.push(['message.start', { turn_id: turnId }])
        let segment = 0
        parts.forEach((reply, index) => {
          if (reply.kind === 'tool') {
            const toolId = `tool-${turn}-${index}`
            sent.push(['tool.start', { tool_id: toolId, name: 'search' }])
            sent.push(['tool.complete', { tool_id: toolId, duration_s: 1 }])
            segment += 1
            return
          }
          let offset = 0
          for (const text of reply.chunks) {
            sent.push(['message.delta', { text, turn_id: turnId, segment, offset }])
            offset += text.length
          }
        })
        sent.push(['message.complete', { status: 'complete', turn_id: turnId }])
      })
      return sent.map(
        ([type, payload], index) =>
          ({ type, payload, session_id: sessionId, seq: index + 1 }) as GatewayEvent
      )
    })
}
