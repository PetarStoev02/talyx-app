import { useEffect } from 'react'
import { useNavigation } from '@app/providers/useNavigation'

const isMac = navigator.platform.toLowerCase().includes('mac')

// ⌘, opens Settings and closes it again. ⌘1 and up open the footer dock's pages in order; the dock
// binds them (SidebarFooter).
export function useKeyboardShortcuts(): void {
  const toggleSettings = useNavigation((s) => s.toggleSettings)

  useEffect(() => {
    function handler(e: KeyboardEvent): void {
      if (!(isMac ? e.metaKey : e.ctrlKey) || e.key !== ',') return
      e.preventDefault()
      void toggleSettings()
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleSettings])
}
