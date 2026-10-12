import { create } from 'zustand'

interface SortOperation {
  id?: number
  batchId: string
  sourcePath: string
  destPath: string
  operationType: 'copy' | 'move'
  category: string | null
  subcategory: string | null
  fileName: string
  fileSize: number | null
  createdAt: string
}

interface SortBatch {
  batchId: string
  operations: SortOperation[]
  timestamp: string
  totalFiles: number
  undoneAt: string | null
}

interface HistoryState {
  batches: SortBatch[]
  loading: boolean
  undoing: string | null
  selectedBatchId: string | null
  setBatches: (batches: SortBatch[]) => void
  setLoading: (loading: boolean) => void
  setUndoing: (batchId: string | null) => void
  selectBatch: (batchId: string | null) => void
  removeBatch: (batchId: string) => void
  markBatchUndone: (batchId: string) => void
}

export const useHistory = create<HistoryState>((set) => ({
  batches: [],
  loading: false,
  undoing: null,
  selectedBatchId: null,
  setBatches: (batches) => set({ batches }),
  setLoading: (loading) => set({ loading }),
  setUndoing: (batchId) => set({ undoing: batchId }),
  selectBatch: (batchId) => set({ selectedBatchId: batchId }),
  removeBatch: (batchId) =>
    set((state) => ({
      batches: state.batches.filter((b) => b.batchId !== batchId)
    })),
  markBatchUndone: (batchId) =>
    set((state) => ({
      batches: state.batches.map((b) =>
        b.batchId === batchId ? { ...b, undoneAt: new Date().toISOString() } : b
      )
    }))
}))
