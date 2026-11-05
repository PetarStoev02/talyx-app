import { useEffect } from 'react'
import { type AppView, useNavigation } from '@app/providers/useNavigation'

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
