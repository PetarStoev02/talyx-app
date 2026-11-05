import { useEffect } from 'react'
import { LoaderCircle } from 'lucide-react'
import { useEngine } from '@app/providers/useEngine'
import { useLanguage } from '@app/providers/useLanguage'
import { host } from '@shared/engine/host'
import { useElapsed } from '@shared/hooks/useElapsed'
import { reportError } from '@shared/lib/report'

// After this long without the socket, the engine itself is checked again: it may have stopped.
const RECHECK_AFTER_MS = 30_000

/**
 * A bar over the page while the engine's socket is down after having been open. It redials by
 * itself; the bar says so, and after a while offers to try at once and checks the engine again,
 * which brings back the engine screen if the engine is gone.
 */
export function ConnectionBanner(): React.JSX.Element | null {
  const t = useLanguage((s) => s.t)
  const lostAt = useEngine((s) => s.lostAt)
  const attached = useEngine((s) => s.status?.state === 'attached')
  const check = useEngine((s) => s.check)
  const longLost = useElapsed(lostAt, RECHECK_AFTER_MS)

  useEffect(() => {
    if (longLost) void check()
  }, [longLost, check])

  const shown = attached && lostAt !== null
  return (
    // Always mounted, so a screen reader hears the bar appear.
    <div role="status" className="empty:hidden">
      {shown && (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-secondary px-4 py-2 text-sm">
          <LoaderCircle
            size={16}
            className="animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
          <span>{t(longLost ? 'engine.stillReconnecting' : 'engine.reconnecting')}</span>
          {longLost && (
            <button
              className="underline underline-offset-4 hover:decoration-2"
              onClick={() =>
                host.retryNow().catch((error: unknown) => reportError('engine', error))
              }
            >
              {t('engine.tryNow')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
