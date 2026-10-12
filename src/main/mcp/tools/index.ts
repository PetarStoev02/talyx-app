import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McpServices } from '../types'
import { registerScanFolder } from './scan-folder'
import { registerClassifyFiles } from './classify-files'
import { registerExecuteSort } from './execute-sort'
import { registerFileMetadata } from './file-metadata'
import { registerExtractText } from './extract-text'
import { registerUndoSort } from './undo-sort'
import { registerSortHistory } from './sort-history'
import { registerSearchFiles } from './search-files'
import { registerWatchFolder } from './watch-folder'

export function registerAllTools(server: McpServer, services: McpServices): void {
  registerScanFolder(server)
  registerClassifyFiles(server)
  registerExecuteSort(server, services)
  registerFileMetadata(server, services)
  registerExtractText(server, services)
  registerUndoSort(server, services)
  registerSortHistory(server, services)
  registerSearchFiles(server, services)
  registerWatchFolder(server, services)
}
