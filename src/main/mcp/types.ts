import type { SortExecutor } from '../domain/sorting/services/SortExecutor'
import type { UndoService } from '../domain/sorting/services/UndoService'
import type { SortHistoryRepo } from '../domain/sorting/repository/SortHistoryRepo'
import type { WatchFolderRepo } from '../domain/watching/repository/WatchFolderRepo'
import type { SearchService } from '../domain/search/services/SearchService'
import type { ExtensionClassifier } from '../domain/classification/services/ExtensionClassifier'
import type { MetadataClassifier } from '../domain/classification/services/MetadataClassifier'
import type { TextExtractor } from '../domain/classification/services/TextExtractor'

export interface McpServices {
  historyRepo: SortHistoryRepo
  watchFolderRepo: WatchFolderRepo
  searchService: SearchService
  executor: SortExecutor
  undoService: UndoService
  extensionClassifier: ExtensionClassifier
  metadataClassifier: MetadataClassifier
  textExtractor: TextExtractor
}

export interface FileEntry {
  path: string
  name: string
  size: number
  extension: string
  modifiedAt: string
  isDirectory: boolean
}
