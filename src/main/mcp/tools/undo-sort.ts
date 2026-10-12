import { z } from 'zod/v4'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McpServices } from '../types'

export function registerUndoSort(server: McpServer, services: McpServices): void {
  server.tool(
    'undo_sort',
    'Undo a previous sort operation by batch ID. Reverses file moves/copies in LIFO order.',
    {
      batchId: z.string().describe('The batch ID of the sort operation to undo')
    },
    async ({ batchId }) => {
      const result = await services.undoService.undoBatch(batchId)

      if (!result.ok) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ success: false, error: result.error })
            }
          ]
        }
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              reversedCount: result.value.reversed,
              keptFiles: result.value.failed
            })
          }
        ]
      }
    }
  )
}
