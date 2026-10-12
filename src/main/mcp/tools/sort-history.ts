import { z } from 'zod/v4'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McpServices } from '../types'

export function registerSortHistory(server: McpServer, services: McpServices): void {
  server.tool(
    'sort_history',
    'Retrieve sort operation history. Returns batches of file operations with timestamps and file details.',
    {
      limit: z.number().int().min(1).max(100).default(20).describe('Maximum batches to return'),
      offset: z.number().int().min(0).default(0).describe('Offset for pagination')
    },
    async ({ limit, offset }) => {
      const batches = services.historyRepo.getHistory(limit, offset)

      const result = batches.map((batch) => ({
        batchId: batch.batchId,
        timestamp: batch.timestamp.toISOString(),
        totalFiles: batch.totalFiles,
        operations: batch.operations.map((op) => ({
          fileName: op.fileName,
          sourcePath: op.sourcePath,
          destPath: op.destPath,
          category: op.category,
          subcategory: op.subcategory,
          mode: op.operationType
        }))
      }))

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
      }
    }
  )
}
