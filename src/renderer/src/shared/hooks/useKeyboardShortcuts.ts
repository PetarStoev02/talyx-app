import { useEffect } from 'react'
import { type AppView, useNavigation } from '@app/providers/useNavigation'
import { useShell } from '@app/providers/useShell'

const isMac = navigator.platform.toLowerCase().includes('mac')

const NAV_KEYS: Record<string, AppView> = {
  '1': 'agents',
  '2': 'engine-debug',
  ',': 'settings'
}

export function useKeyboardShortcuts(): void {
  const navigate = useNavigation((s) => s.navigate)

  useEffect(() => {
    function handler(e: KeyboardEvent): void {
      if (!(isMac ? e.metaKey : e.ctrlKey)) return

      if (e.key === '\\') {
        e.preventDefault()
        useShell.getState().toggleSidebar()
        return
      }

      const view = NAV_KEYS[e.key]
      if (view) {
        e.preventDefault()
        navigate(view)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate])
}
