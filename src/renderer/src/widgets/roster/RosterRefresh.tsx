import { RefreshCw } from 'lucide-react'
import { useLanguage } from '@shared/lib/i18n'
import { runRosterMutation } from '@features/bots/actions'
import type { RosterBackend } from '@features/bots/data'
import { useRoster } from '@features/bots/store'
import { IconButton } from '@shared/ui/IconButton'
import { useMinSpin } from '@shared/hooks/useMinSpin'
import { cn } from '@shared/lib/utils'

/**
 * Reads the roster again now instead of at the next 10 s poll; every mutation re-reads the roster
 * afterwards, so a reload is an empty mutation. The icon spins (dimmed under reduced motion) while
 * it runs.
 */
export function RosterRefresh({ backend }: { backend: RosterBackend }): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const saving = useRoster((state) => state.saving)
  const { spinning: refreshing, spin } = useMinSpin()

  async function refresh(): Promise<void> {
    await spin(() => runRosterMutation(backend, () => Promise.resolve()))
  }

  return (
    <IconButton
      label={t('roster.refresh')}
      disabled={saving || refreshing}
      aria-busy={refreshing}
      onClick={() => void refresh()}
    >
      <RefreshCw className={cn(refreshing && 'animate-spin motion-reduce:animate-none')} />
    </IconButton>
  )
}
