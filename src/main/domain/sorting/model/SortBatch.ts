import type { SortOperation } from './SortOperation'

export interface SortBatch {
  batchId: string
  operations: SortOperation[]
  timestamp: Date
  totalFiles: number
  /** When the batch was undone, or null while its files remain sorted */
  undoneAt: string | null
}
