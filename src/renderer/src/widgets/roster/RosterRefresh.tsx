import { RefreshCw } from 'lucide-react'
import { useLanguage } from '@app/providers/useLanguage'
import { runRosterMutation } from '@features/bots/actions'
import type { RosterBackend } from '@features/bots/data'
import { useRoster } from '@features/bots/store'
import { IconButton } from '@shared/ui/IconButton'

/**
 * Reads the roster again now instead of at the next 10 s poll; every mutation re-reads the roster
 * afterwards, so a reload is an empty mutation.
 */
export function RosterRefresh({ backend }: { backend: RosterBackend }): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const saving = useRoster((state) => state.saving)
  return (
    <IconButton
      label={t('roster.refresh')}
      disabled={saving}
      onClick={() => void runRosterMutation(backend, () => Promise.resolve())}
    >
      <RefreshCw />
    </IconButton>
  )
}
