import { z } from 'zod/v4'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McpServices } from '../types'

export function registerExtractText(server: McpServer, services: McpServices): void {
  server.tool(
    'extract_text',
    'Extract text content from a file (PDF, DOCX, XLSX, PPTX, TXT, HTML). Images yield EXIF metadata only, not OCR. Returns extracted text and metadata.',
    {
      path: z.string().describe('Absolute path to the file'),
      maxChars: z
        .number()
        .int()
        .min(100)
        .max(100000)
        .default(8000)
        .describe('Maximum characters to return')
    },
    async ({ path: filePath, maxChars }) => {
      const result = await services.textExtractor.extract(filePath)

      const truncatedText =
        result.text.length > maxChars ? result.text.slice(0, maxChars) : result.text

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                path: filePath,
                text: truncatedText,
                truncated: result.text.length > maxChars || result.truncated,
                originalLength: result.text.length,
                metadata: result.metadata
              },
              null,
              2
            )
          }
        ]
      }
    }
  )
}
