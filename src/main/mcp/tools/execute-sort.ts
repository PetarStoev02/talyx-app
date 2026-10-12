import { z } from 'zod/v4'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McpServices } from '../types'
import { buildSortPlan, toClassifiedFiles } from './classify-files'
import { absolutePath } from '../../infrastructure/ipc/validation'

export function registerExecuteSort(server: McpServer, services: McpServices): void {
  server.tool(
    'execute_sort',
    'Execute a file sort operation. Takes classified files with categories and moves/copies them into organized folders.',
    {
      files: z.array(
        z.object({
          path: absolutePath.describe('Absolute path to the file'),
          category: z.string().describe('Top-level category'),
          subcategory: z.string().nullable().describe('Subcategory'),
          suggestedName: z.string().nullable().describe('AI-suggested rename, or null')
        })
      ),
      outputDir: absolutePath.describe('Absolute path to the output directory'),
      mode: z.enum(['copy', 'move']).default('copy').describe('Sort mode: copy or move files')
    },
    async ({ files, outputDir, mode }) => {
      const { plan, skipped } = await buildSortPlan(files)

      if (plan.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                success: false,
                error: 'No valid files to sort',
                skipped
              })
            }
          ]
        }
      }

      const classifiedFiles = toClassifiedFiles(plan)

      const approvedRenames: Record<string, string> = {}
      for (const entry of plan) {
        if (entry.suggestedName) {
          approvedRenames[entry.path] = entry.suggestedName
        }
      }

      const batch = await services.executor.executeBatch(
        classifiedFiles,
        outputDir,
        mode,
        undefined,
        Object.keys(approvedRenames).length > 0 ? approvedRenames : undefined
      )

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              batchId: batch.batchId,
              totalFiles: batch.totalFiles,
              skipped
            })
          }
        ]
      }
    }
  )
}
