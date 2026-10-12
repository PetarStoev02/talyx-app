import type { SortBatch } from '@shared/api/ipc'

export interface RecentSortRow {
  batchId: string
  label: string
  fileCount: number
  timestamp: string
  undoneAt: string | null
}

const MAX_RECENT_SORTS = 5

/** Label a batch by the last segment of its first operation's source dir */
export function deriveBatchLabel(batch: SortBatch): string {
  const source = batch.operations[0]?.sourcePath ?? ''
  const dir = source.replace(/\\/g, '/').split('/').slice(0, -1)
  return dir[dir.length - 1] || dir[dir.length - 2] || '—'
}

/** Derive sidebar "Recent sorts" rows: label = last segment of the first operation's source dir */
export function deriveRecentSorts(batches: SortBatch[]): RecentSortRow[] {
  return batches.slice(0, MAX_RECENT_SORTS).map((b) => ({
    batchId: b.batchId,
    label: deriveBatchLabel(b),
    fileCount: b.totalFiles,
    timestamp: b.timestamp,
    undoneAt: b.undoneAt
  }))
}
