import { useEffect } from 'react'
import { type AppView, useNavigation } from '@app/providers/useNavigation'
import { useSortSession } from '@app/providers/useSortSession'
import { useShell } from '@app/providers/useShell'
import { folderApi, sortApi } from '@shared/api/ipc'
import { useLanguage } from '@app/providers/useLanguage'
import { announceUndo } from '@shared/lib/undoToast'

const isMac = navigator.platform.toLowerCase().includes('mac')

function isModKey(e: KeyboardEvent): boolean {
  return isMac ? e.metaKey : e.ctrlKey
}

// Matches the sidebar's advertised hints: ⌘1 Ask … ⌘4 Search (History via See all / ⌘K)
const NAV_KEYS: Record<string, AppView> = {
  '1': 'ask',
  '2': 'sort',
  '3': 'watch',
  '4': 'search'
}

export interface ShortcutEntry {
  keys: string
  description: string
}

const mod = isMac ? 'Cmd' : 'Ctrl'

export const SHORTCUTS: ShortcutEntry[] = [
  { keys: `${mod}+1`, description: 'Go to Ask' },
  { keys: `${mod}+2`, description: 'Go to Sort' },
  { keys: `${mod}+3`, description: 'Go to Watch' },
  { keys: `${mod}+4`, description: 'Go to Search' },
  { keys: `${mod}+K`, description: 'Quick actions' },
  { keys: `${mod}+\\`, description: 'Toggle sidebar' },
  { keys: `${mod}+O`, description: 'Select source folder' },
  { keys: `${mod}+Shift+O`, description: 'Select output folder' },
  { keys: `${mod}+Enter`, description: 'Start scan or sort' },
  { keys: `${mod}+Z`, description: 'Undo last sort batch' },
  { keys: 'Escape', description: 'Reset / cancel' }
]

export function useKeyboardShortcuts(): void {
  const navigate = useNavigation((s) => s.navigate)
  const currentView = useNavigation((s) => s.currentView)

  useEffect(() => {
    function handler(e: KeyboardEvent): void {
      // Don't intercept shortcuts when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        // Only allow Escape in inputs
        if (e.key !== 'Escape') return
      }

      // Escape: reset sort session
      if (e.key === 'Escape') {
        if (currentView === 'sort') {
          useSortSession.getState().reset()
        }
        return
      }

      if (!isModKey(e)) return

      // Cmd/Ctrl+K: the quick-actions palette, from anywhere
      if (e.key === 'k') {
        e.preventDefault()
        useShell.getState().openQuickActions()
        return
      }

      // Cmd/Ctrl+\: toggle sidebar collapse
      if (e.key === '\\') {
        e.preventDefault()
        useShell.getState().toggleSidebar()
        return
      }

      // Cmd/Ctrl+1-4: Navigate to pages
      const view = NAV_KEYS[e.key]
      if (view) {
        e.preventDefault()
        navigate(view)
        return
      }

      // Cmd/Ctrl+O: Select source folder
      if (e.key === 'o' && !e.shiftKey) {
        e.preventDefault()
        navigate('sort')
        folderApi.select().then((path) => {
          if (path) {
            const state = useSortSession.getState()
            state.setSourceFolder(path)
            state.setClassified([])
            state.setFiles([])
            state.setStatus('idle')
            state.setError(null)
          }
        })
        return
      }

      // Cmd/Ctrl+Shift+O: Select output folder
      if (e.key === 'o' && e.shiftKey) {
        e.preventDefault()
        navigate('sort')
        folderApi.select().then((path) => {
          if (path) useSortSession.getState().setOutputFolder(path)
        })
        return
      }

      // Cmd/Ctrl+Enter: Start scan/sort
      if (e.key === 'Enter') {
        e.preventDefault()
        const state = useSortSession.getState()
        if (state.status === 'idle' && state.sourceFolder && state.outputFolder) {
          navigate('sort')
        }
        return
      }

      // Cmd/Ctrl+Z: Undo last sort batch
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        const state = useSortSession.getState()
        if (state.batchId && state.status === 'done') {
          sortApi.undo(state.batchId).then((reply) => {
            if (announceUndo(reply, useLanguage.getState().t)) state.reset()
          })
        }
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate, currentView])
}
