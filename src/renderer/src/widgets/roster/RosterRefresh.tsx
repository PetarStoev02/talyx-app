import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useLanguage } from '@shared/lib/i18n'
import { runRosterMutation } from '@features/bots/actions'
import type { RosterBackend } from '@features/bots/data'
import { useRoster } from '@features/bots/store'
import { IconButton } from '@shared/ui/IconButton'
import { useElapsed } from '@shared/hooks/useElapsed'
import { cn } from '@shared/lib/utils'

// A read takes a few milliseconds and usually changes nothing, so the spin lasts at least this
// long to be seen.
const MIN_SPIN_MS = 600

/**
 * Reads the roster again now instead of at the next 10 s poll; every mutation re-reads the roster
 * afterwards, so a reload is an empty mutation. The icon spins (dimmed under reduced motion) while
 * it runs.
 */
export function RosterRefresh({ backend }: { backend: RosterBackend }): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const saving = useRoster((state) => state.saving)
  const [reading, setReading] = useState(false)
  const [started, setStarted] = useState<number | null>(null)
  const spun = useElapsed(started, MIN_SPIN_MS)
  const refreshing = reading || (started !== null && !spun)

  async function refresh(): Promise<void> {
    setReading(true)
    setStarted(Date.now())
    try {
      await runRosterMutation(backend, () => Promise.resolve())
    } finally {
      setReading(false)
    }
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
