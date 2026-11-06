import { useEffect } from 'react'
import { Bot, Settings } from 'lucide-react'
import { useEngine } from '@app/providers/useEngine'
import { updateItems } from '@features/updates/items'
import { useUpdates } from '@features/updates/store'
import { reportError } from '@shared/lib/report'
import { NavButton } from './NavButton'
import { UpdateButton } from './UpdateButton'

const isMac = navigator.platform.toLowerCase().includes('mac')
const mod = isMac ? '⌘' : 'Ctrl+'

/**
 * One row of icon buttons: the pages on the left, `end` (the roster's refresh) on the right.
 * While a Talyx or engine update is pending, the update button takes `end`'s place.
 * Without a roster (no engine yet) the Agents page gets a button too, as the way back to it.
 */
export function SidebarFooter({
  withRoster,
  end
}: {
  withRoster: boolean
  end: React.ReactNode
}): React.JSX.Element {
  const engine = useEngine((s) => s.status)
  const update = useUpdates((s) => s.state)
  const items = updateItems(engine, update)

  useEffect(() => {
    useUpdates
      .getState()
      .load()
      .catch((error: unknown) => reportError('updater', error))
  }, [])

  return (
    <div className="flex items-center gap-1 px-3 pt-3 pb-4">
      {!withRoster && (
        <NavButton view="agents" labelKey="nav.agents" icon={Bot} shortcut={`${mod}1`} />
      )}
      <NavButton view="settings" labelKey="nav.settings" icon={Settings} shortcut={`${mod},`} />
      <span className="ml-auto">{items.length > 0 ? <UpdateButton items={items} /> : end}</span>
    </div>
  )
}
