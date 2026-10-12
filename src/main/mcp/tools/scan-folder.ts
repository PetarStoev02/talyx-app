import { readdir, stat } from 'fs/promises'
import { join, extname } from 'path'
import { z } from 'zod/v4'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { FileEntry } from '../types'

export async function scanDirectory(
  dirPath: string,
  recursive: boolean,
  maxDepth: number,
  currentDepth: number = 0
): Promise<FileEntry[]> {
  const entries: FileEntry[] = []

  const dirents = await readdir(dirPath, { withFileTypes: true })

  for (const dirent of dirents) {
    const fullPath = join(dirPath, dirent.name)
    const stats = await stat(fullPath)

    entries.push({
      path: fullPath,
      name: dirent.name,
      size: stats.size,
      extension: dirent.isDirectory() ? '' : extname(dirent.name).toLowerCase(),
      modifiedAt: stats.mtime.toISOString(),
      isDirectory: dirent.isDirectory()
    })

    if (recursive && dirent.isDirectory() && currentDepth < maxDepth) {
      const children = await scanDirectory(fullPath, recursive, maxDepth, currentDepth + 1)
      entries.push(...children)
    }
  }

  return entries
}

export function registerScanFolder(server: McpServer): void {
  server.tool(
    'scan_folder',
    'Scan a directory and list all files with metadata (name, size, extension, modified date)',
    {
      path: z.string().describe('Absolute path to the directory to scan'),
      recursive: z.boolean().default(false).describe('Whether to scan subdirectories'),
      maxDepth: z.number().int().min(0).max(10).default(3).describe('Maximum recursion depth')
    },
    async ({ path: dirPath, recursive, maxDepth }) => {
      const entries = await scanDirectory(dirPath, recursive, maxDepth)
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(entries, null, 2) }]
      }
    }
  )
}
