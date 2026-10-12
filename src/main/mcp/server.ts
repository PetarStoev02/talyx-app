import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import Database from 'better-sqlite3'
import { join } from 'path'
import { homedir } from 'os'
import { runMigrations } from '../infrastructure/database/migrations'
import { SortHistoryRepo } from '../domain/sorting/repository/SortHistoryRepo'
import { SortExecutor } from '../domain/sorting/services/SortExecutor'
import { UndoService } from '../domain/sorting/services/UndoService'
import { WatchFolderRepo } from '../domain/watching/repository/WatchFolderRepo'
import { SearchIndexRepo } from '../domain/search/repository/SearchIndexRepo'
import { SearchService } from '../domain/search/services/SearchService'
import { ExtensionClassifier } from '../domain/classification/services/ExtensionClassifier'
import { MetadataClassifier } from '../domain/classification/services/MetadataClassifier'
import { TextExtractor } from '../domain/classification/services/TextExtractor'
import { DeepScanService } from '../domain/search/services/DeepScanService'
import log from 'electron-log'
import { registerAllTools } from './tools/index'
import type { McpServices } from './types'

/**
 * Resolves the Talyx database path without depending on Electron APIs.
 * Mirrors the path that Electron's app.getPath('userData') would produce.
 */
function getDatabasePath(): string {
  return join(homedir(), 'Library', 'Application Support', 'talyx', 'talyx.db')
}

function initDatabase(): Database.Database {
  const dbPath = getDatabasePath()
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  return db
}

function createServices(db: Database.Database): McpServices {
  const historyRepo = new SortHistoryRepo(db)
  const watchFolderRepo = new WatchFolderRepo(db)
  const searchIndexRepo = new SearchIndexRepo(db)
  const extensionClassifier = new ExtensionClassifier()
  const metadataClassifier = new MetadataClassifier()
  const textExtractor = new TextExtractor()
  const deepScanService = new DeepScanService(searchIndexRepo, textExtractor, extensionClassifier)
  const searchService = new SearchService(searchIndexRepo)
  const executor = new SortExecutor(historyRepo, deepScanService)
  const undoService = new UndoService(historyRepo)

  return {
    historyRepo,
    watchFolderRepo,
    searchService,
    executor,
    undoService,
    extensionClassifier,
    metadataClassifier,
    textExtractor
  }
}

async function main(): Promise<void> {
  // stdout is the JSON-RPC stream. electron-log prints info lines there when it
  // runs outside Electron, which is enough to break every call this server gets.
  log.transports.console.level = false

  const db = initDatabase()

  const server = new McpServer({
    name: 'talyx',
    version: __APP_VERSION__
  })

  const services = createServices(db)
  registerAllTools(server, services)

  const transport = new StdioServerTransport()
  await server.connect(transport)

  // Graceful shutdown
  process.on('SIGINT', () => {
    db.close()
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    db.close()
    process.exit(0)
  })
}

main().catch((err) => {
  console.error('MCP server failed to start:', err)
  process.exit(1)
})
