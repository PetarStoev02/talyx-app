import type { SortMode } from '../../sorting/model/SortMode'

export interface WatchFolder {
  id?: number
  path: string
  enabled: boolean
  outputPath: string | null
  sortMode: SortMode
  createdAt: string
}
