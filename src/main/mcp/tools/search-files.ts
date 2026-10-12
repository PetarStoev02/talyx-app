import { z } from 'zod/v4'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McpServices } from '../types'

export function registerSearchFiles(server: McpServer, services: McpServices): void {
  server.tool(
    'search_files',
    'Search indexed file contents using keyword search. Returns matching file paths with text snippets and relevance ranking.',
    {
      query: z.string().min(1).describe('Search query (keywords)'),
      limit: z.number().int().min(1).max(100).default(20).describe('Maximum results to return')
    },
    async ({ query, limit }) => {
      const results = await services.searchService.search(query, limit)

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }]
      }
    }
  )
}
