import { Bot } from 'lucide-react'
import { NavButton } from './NavButton'

const isMac = navigator.platform.toLowerCase().includes('mac')

export function SidebarNav({ collapsed }: { collapsed: boolean }): React.JSX.Element {
  return (
    <nav className="flex flex-col gap-0.5 px-2">
      <NavButton
        view="agents"
        labelKey="nav.agents"
        icon={Bot}
        shortcut={`${isMac ? '⌘' : 'Ctrl+'}1`}
        collapsed={collapsed}
      />
    </nav>
  )
}
