import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { updaterApi } from '@shared/api/ipc'
import { useLanguage } from '@app/providers/useLanguage'

export interface ReleaseInfo {
  version: string
  url: string
}

/** The newer release the main process announced, or null. Announced once per session. */
export function useAutoUpdater(): ReleaseInfo | null {
  const t = useLanguage((s) => s.t)
  const announced = useRef(false)
  const [release, setRelease] = useState<ReleaseInfo | null>(null)

  useEffect(() => {
    // Stopgap until the update button replaces this hook.
    return updaterApi.onState((state) => {
      if (announced.current || state.kind !== 'available') return
      announced.current = true
      const info = { version: state.release.version, url: state.release.url }
      setRelease(info)
      toast(t('updater.available').replace('{version}', info.version), {
        id: 'update-available',
        action: { label: t('updater.openPage'), onClick: () => window.open(info.url, '_blank') },
        duration: 15000
      })
    })
  }, [t])

  return release
}
