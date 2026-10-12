import { stat } from 'fs/promises'
import { basename, extname } from 'path'
import { z } from 'zod/v4'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McpServices } from '../types'

export function registerFileMetadata(server: McpServer, services: McpServices): void {
  server.tool(
    'file_metadata',
    'Get detailed metadata for a file including extension-based classification, content-based metadata (EXIF for images, etc.), and file system stats.',
    {
      path: z.string().describe('Absolute path to the file')
    },
    async ({ path: filePath }) => {
      const stats = await stat(filePath)
      const name = basename(filePath)
      const ext = extname(filePath).toLowerCase()

      const extensionResult = services.extensionClassifier.classify(name)
      const metadataResult = await services.metadataClassifier.classify(
        filePath,
        extensionResult.category
      )

      const result = {
        path: filePath,
        name,
        extension: ext,
        size: stats.size,
        modifiedAt: stats.mtime.toISOString(),
        createdAt: stats.birthtime.toISOString(),
        isDirectory: stats.isDirectory(),
        classification: {
          category: extensionResult.category,
          subcategory: metadataResult.subcategory ?? extensionResult.subcategory,
          confidence: extensionResult.confidence
        },
        metadata: metadataResult.metadata
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
      }
    }
  )
}
