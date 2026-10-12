import { create } from 'zustand'
import type { FileEntry, ClassifiedFile, SortProgress } from '@shared/api/ipc'

export type SortStatus = 'idle' | 'scanning' | 'previewing' | 'sorting' | 'done' | 'error'

interface SortSessionState {
  sourceFolder: string | null
  outputFolder: string | null
  mode: 'copy' | 'move'
  files: FileEntry[]
  classified: ClassifiedFile[]
  status: SortStatus
  progress: SortProgress | null
  error: string | null
  batchId: string | null
  approvedRenames: Record<string, string>
  rejectedRenames: Set<string>

  setSourceFolder: (path: string | null) => void
  setOutputFolder: (path: string | null) => void
  setMode: (mode: 'copy' | 'move') => void
  setFiles: (files: FileEntry[]) => void
  setClassified: (classified: ClassifiedFile[]) => void
  setStatus: (status: SortStatus) => void
  setProgress: (progress: SortProgress | null) => void
  setError: (error: string | null) => void
  setBatchId: (id: string | null) => void
  setApprovedRename: (sourcePath: string, newName: string) => void
  removeApprovedRename: (sourcePath: string) => void
  rejectRename: (sourcePath: string) => void
  rejectAllRenames: () => void
  clearApprovedRenames: () => void
  approveAllRenames: (renames: Record<string, string>) => void
  reset: () => void
}

const initialState = {
  sourceFolder: null,
  outputFolder: null,
  mode: 'copy' as const,
  files: [],
  classified: [],
  status: 'idle' as SortStatus,
  progress: null,
  error: null,
  batchId: null,
  approvedRenames: {} as Record<string, string>,
  rejectedRenames: new Set<string>()
}

export const useSortSession = create<SortSessionState>((set) => ({
  ...initialState,

  setSourceFolder: (path) => set({ sourceFolder: path }),
  setOutputFolder: (path) => set({ outputFolder: path }),
  setMode: (mode) => set({ mode }),
  setFiles: (files) => set({ files }),
  setClassified: (classified) => set({ classified }),
  setStatus: (status) => set({ status }),
  setProgress: (progress) => set({ progress }),
  setError: (error) => set({ error }),
  setBatchId: (id) => set({ batchId: id }),
  setApprovedRename: (sourcePath, newName) =>
    set((state) => ({
      approvedRenames: { ...state.approvedRenames, [sourcePath]: newName }
    })),
  removeApprovedRename: (sourcePath) =>
    set((state) => {
      const next = { ...state.approvedRenames }
      delete next[sourcePath]
      return { approvedRenames: next }
    }),
  rejectRename: (sourcePath) =>
    set((state) => {
      const next = { ...state.approvedRenames }
      delete next[sourcePath]
      const rejected = new Set(state.rejectedRenames)
      rejected.add(sourcePath)
      return { approvedRenames: next, rejectedRenames: rejected }
    }),
  rejectAllRenames: () =>
    set({ approvedRenames: {}, rejectedRenames: new Set<string>(['__ALL_REJECTED__']) }),
  clearApprovedRenames: () => set({ approvedRenames: {}, rejectedRenames: new Set<string>() }),
  approveAllRenames: (renames) =>
    set((state) => ({
      approvedRenames: { ...state.approvedRenames, ...renames }
    })),
  reset: () => set(initialState)
}))
