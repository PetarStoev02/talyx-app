import { useEffect, useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { updaterApi } from '@shared/api/ipc'
import { useLanguage } from '@app/providers/useLanguage'

export type UpdateStatus = 'idle' | 'available'

export interface UpdateState {
  status: UpdateStatus
  version: string | null
  url: string | null
  checkForUpdates: () => void
  openReleasePage: () => void
}

interface ReleaseInfo {
  version: string
  url: string
}

export function useAutoUpdater(): UpdateState {
  const t = useLanguage((s) => s.t)
  const updateToastShown = useRef(false)
  const [status, setStatus] = useState<UpdateStatus>('idle')
  const [version, setVersion] = useState<string | null>(null)
  const [url, setUrl] = useState<string | null>(null)

  const showUpdate = useCallback(
    (info: ReleaseInfo) => {
      setStatus('available')
      setVersion(info.version)
      setUrl(info.url)
      toast(t('updater.available').replace('{version}', info.version), {
        id: 'update-available',
        action: {
          label: t('updater.openPage'),
          onClick: () => window.open(info.url, '_blank')
        },
        duration: 15000
      })
    },
    [t]
  )

  useEffect(() => {
    return updaterApi.onUpdateAvailable((info) => {
      // Scheduled checks announce once per session; manual checks always answer.
      if (updateToastShown.current) return
      updateToastShown.current = true
      showUpdate(info)
    })
  }, [showUpdate])

  const checkForUpdates = useCallback(async () => {
    try {
      const result = await updaterApi.check()
      if (result.status === 'failed') toast.error(t('updater.checkFailed'))
      else if (result.status === 'up-to-date') toast.success(t('updater.upToDate'))
      else if (result.version && result.url)
        showUpdate({ version: result.version, url: result.url })
    } catch {
      toast.error(t('updater.checkFailed'))
    }
  }, [t, showUpdate])

  const openReleasePage = useCallback(() => {
    if (url) window.open(url, '_blank')
  }, [url])

  return { status, version, url, checkForUpdates, openReleasePage }
}
