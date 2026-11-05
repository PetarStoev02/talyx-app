import { Bot, FolderPlus, MessagesSquare, Plus } from 'lucide-react'
import { useLanguage } from '@app/providers/useLanguage'
import { useRoster } from '@features/bots/store'
import { useCreating } from './creating'
import type { Creating } from './creating'
import { RosterMenu } from './RosterMenu'

/** The `+` that adds a bot, a room or a folder. */
export function RosterAdd(): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const saving = useRoster((state) => state.saving)
  const setCreating = useCreating((s) => s.setCreating)
  const open = (next: Creating): void => {
    useRoster.getState().clearError()
    setCreating(next)
  }
  return (
    <RosterMenu
      label={t('roster.add')}
      disabled={saving}
      icon={<Plus size={16} />}
      // A white disc on the sidebar's tone, so the one create action stands out.
      className="size-8 bg-background shadow-xs hover:bg-background/70"
      actions={[
        { label: t('create.title'), icon: Bot, onSelect: () => open('bot') },
        { label: t('roster.newRoom'), icon: MessagesSquare, onSelect: () => open('room') },
        { label: t('roster.newFolder'), icon: FolderPlus, onSelect: () => open('folder') }
      ]}
    />
  )
}
