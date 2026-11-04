import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useEngine } from '@app/providers/useEngine'
import { useLanguage } from '@app/providers/useLanguage'
import { host } from '@shared/engine/host'
import type { ConnectionState } from '@shared/engine/shared'
import { Button } from '@shared/ui/button'
import { PageHeader } from '@shared/ui/page-header'
import { EngineGate } from '@widgets/engine-gate'

const MAX_LOG_LINES = 500

/** PR 2's proof page: one profile, one "ping", the raw session events as the gateway sends them. */
export function EngineDebugPage(): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t('nav.engineDebug')} />
      <EngineGate>
        <DebugConsole />
      </EngineGate>
    </div>
  )
}

function DebugConsole(): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const stale = useEngine((s) => s.status?.state === 'attached' && s.status.stale)
  const [profiles, setProfiles] = useState<string[]>([])
  const [profile, setProfile] = useState('default')
  const [connection, setConnection] = useState<ConnectionState>('idle')
  const [log, setLog] = useState<string[]>([])
  const sessions = useRef(new Map<string, string>())

  useEffect(() => host.onState(setConnection), [])

  useEffect(
    () =>
      host.onEvent((event) =>
        setLog((lines) => [...lines, JSON.stringify(event)].slice(-MAX_LOG_LINES))
      ),
    []
  )

  useEffect(() => {
    if (connection !== 'open') return
    host
      .request<{ profiles: Array<{ name: string }> }>('default', 'profiles.list')
      .then((result) => setProfiles(result.profiles.map((row) => row.name)))
      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : String(err)))
  }, [connection])

  async function ping(): Promise<void> {
    try {
      let sessionId = sessions.current.get(profile)
      if (!sessionId) {
        const created = await host.request<{ session_id: string }>(profile, 'session.create', {
          title: 'Talyx engine debug'
        })
        sessionId = created.session_id
        sessions.current.set(profile, sessionId)
        // Opening a session is a resume: its snapshot names the replay owner the client needs
        // to replay this session after a dropped socket.
        await host.request(profile, 'session.resume', { session_id: sessionId })
      }
      const receipt = await host.request(profile, 'prompt.submit', {
        session_id: sessionId,
        text: 'ping'
      })
      setLog((lines) => [...lines, `submit → ${JSON.stringify(receipt)}`])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          {t('engine.debugProfile')}
          <select
            className="rounded-full bg-secondary px-3 py-1.5 text-sm"
            value={profile}
            onChange={(e) => setProfile(e.target.value)}
          >
            {(profiles.length ? profiles : ['default']).map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <Button
          className="rounded-full px-5"
          disabled={connection !== 'open'}
          onClick={() => void ping()}
        >
          {t('engine.debugPing')}
        </Button>
        <button className="text-sm underline underline-offset-4" onClick={() => host.dropSocket()}>
          {t('engine.debugDrop')}
        </button>
        <button className="text-sm underline underline-offset-4" onClick={() => setLog([])}>
          {t('engine.debugClear')}
        </button>
        <span className="ml-auto text-sm text-muted-foreground" data-testid="engine-connection">
          {connection}
        </span>
      </div>
      {stale && <p className="text-sm text-foreground">{t('engine.stale')}</p>}
      <pre
        className="min-h-0 flex-1 overflow-auto rounded-lg bg-secondary p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap"
        data-testid="engine-log"
      >
        {log.length ? log.join('\n') : t('engine.debugWaiting')}
      </pre>
    </div>
  )
}
