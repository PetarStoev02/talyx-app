import type { SortMode } from './SortMode'

export interface SortOperation {
  id?: number
  batchId: string
  sourcePath: string
  destPath: string
  operationType: SortMode
  category: string | null
  subcategory: string | null
  fileName: string
  fileSize: number | null
  originalName?: string | null
  newName?: string | null
  createdAt: string
}
