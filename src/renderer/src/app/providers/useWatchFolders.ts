import { create } from 'zustand'

export interface WatchFolder {
  id: number
  path: string
  enabled: boolean
  outputPath: string | null
  sortMode: 'copy' | 'move'
  createdAt: string
}

interface WatchFoldersState {
  folders: WatchFolder[]
  loading: boolean
  setFolders: (folders: WatchFolder[]) => void
  addFolder: (folder: WatchFolder) => void
  removeFolder: (id: number) => void
  toggleFolder: (id: number, enabled: boolean) => void
  setLoading: (loading: boolean) => void
}

export const useWatchFolders = create<WatchFoldersState>((set) => ({
  folders: [],
  loading: false,
  setFolders: (folders) => set({ folders }),
  addFolder: (folder) => set((s) => ({ folders: [...s.folders, folder] })),
  removeFolder: (id) => set((s) => ({ folders: s.folders.filter((f) => f.id !== id) })),
  toggleFolder: (id, enabled) =>
    set((s) => ({
      folders: s.folders.map((f) => (f.id === id ? { ...f, enabled } : f))
    })),
  setLoading: (loading) => set({ loading })
}))
