import { z } from 'zod/v4'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McpServices } from '../types'
import { absolutePath } from '../../infrastructure/ipc/validation'

export function registerWatchFolder(server: McpServer, services: McpServices): void {
  server.tool(
    'watch_folder',
    'Manage watched folders. Actions: list (show all), add (start watching), remove (stop watching), toggle (enable/disable).',
    {
      action: z.enum(['list', 'add', 'remove', 'toggle']).describe('Action to perform'),
      path: absolutePath.optional().describe('Folder path (required for add)'),
      id: z.number().int().optional().describe('Watch folder ID (required for remove/toggle)'),
      outputPath: absolutePath
        .optional()
        .describe('Output path for sorted files (optional, for add)'),
      sortMode: z.enum(['copy', 'move']).default('copy').describe('Sort mode (for add)')
    },
    async ({ action, path: folderPath, id, outputPath, sortMode }) => {
      switch (action) {
        case 'list': {
          const folders = services.watchFolderRepo.getAll()
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(folders, null, 2) }]
          }
        }

        case 'add': {
          if (!folderPath) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify({ error: 'path is required for add action' })
                }
              ]
            }
          }

          const folder = services.watchFolderRepo.add({
            path: folderPath,
            enabled: true,
            outputPath: outputPath ?? null,
            sortMode
          })

          return {
            content: [{ type: 'text' as const, text: JSON.stringify(folder, null, 2) }]
          }
        }

        case 'remove': {
          if (id === undefined) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify({ error: 'id is required for remove action' })
                }
              ]
            }
          }

          services.watchFolderRepo.remove(id)
          return {
            content: [
              { type: 'text' as const, text: JSON.stringify({ success: true, removedId: id }) }
            ]
          }
        }

        case 'toggle': {
          if (id === undefined) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify({ error: 'id is required for toggle action' })
                }
              ]
            }
          }

          const existing = services.watchFolderRepo.getById(id)
          if (!existing) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify({ error: `Watch folder ${id} not found` })
                }
              ]
            }
          }

          services.watchFolderRepo.setEnabled(id, !existing.enabled)
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({
                  success: true,
                  id,
                  enabled: !existing.enabled
                })
              }
            ]
          }
        }
      }
    }
  )
}
