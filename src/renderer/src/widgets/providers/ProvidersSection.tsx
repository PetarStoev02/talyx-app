import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useLanguage } from '@app/providers/useLanguage'
import {
  canRemoveEndpoint,
  disconnectAccount,
  loadProviders,
  removeEndpoint,
  removeKey,
  revealKey
} from '@features/providers/providers'
import type {
  Account,
  CustomEndpoint,
  KeySlot,
  ProvidersBackend,
  ProvidersOverview
} from '@features/providers/providers'
import { Button } from '@shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@shared/ui/dialog'
import type { ModelOptionProvider } from '@shared/engine/gateway-events'
import { AddProviderDialog } from './AddProviderDialog'
import { DefaultModelSection } from './DefaultModelSection'
import { failureText, reportSpread } from './feedback'

const linkClass = 'text-sm underline underline-offset-4 disabled:opacity-50'

type Removal =
  | { kind: 'endpoint'; endpoint: CustomEndpoint }
  | { kind: 'key'; slot: KeySlot }
  | { kind: 'account'; account: Account }

/**
 * The engine's providers as one list, then Talyx's default model; every change applies at once,
 * there is no Save. Both read one overview, so removing an endpoint also shows the model it took.
 */
export function ProvidersSection({
  backend,
  models
}: {
  backend: ProvidersBackend
  models: ((profile: string) => Promise<ModelOptionProvider[]>) | null
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [overview, setOverview] = useState<ProvidersOverview | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [editing, setEditing] = useState<CustomEndpoint | 'new' | null>(null)
  const [removing, setRemoving] = useState<Removal | null>(null)
  const [revealed, setRevealed] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [loads, setLoads] = useState(0)

  const load = useCallback(
    (): Promise<void> =>
      loadProviders(backend).then(
        (next) => {
          setOverview(next)
          setProblem(null)
          // A revealed value may be stale now, and the model menu must load the new list.
          setRevealed({})
          setLoads((count) => count + 1)
        },
        (error: unknown) => setProblem(failureText(t, error))
      ),
    [backend, t]
  )

  useEffect(() => {
    void load()
  }, [load])

  function hide(key: string): void {
    setRevealed((shown) =>
      Object.fromEntries(Object.entries(shown).filter(([item]) => item !== key))
    )
  }

  async function reveal(slot: KeySlot): Promise<void> {
    if (revealed[slot.key] !== undefined) return hide(slot.key)
    try {
      const value = await revealKey(backend, slot.key)
      setRevealed((shown) => ({ ...shown, [slot.key]: value }))
    } catch (error) {
      toast.error(failureText(t, error))
    }
  }

  async function remove(removal: Removal): Promise<void> {
    setBusy(true)
    try {
      if (removal.kind === 'account') {
        await disconnectAccount(backend, removal.account.id)
        toast.success(t('providers.signedOut'))
      } else {
        const failed =
          removal.kind === 'endpoint'
            ? await removeEndpoint(backend, removal.endpoint.id)
            : await removeKey(backend, removal.slot.key)
        reportSpread(t, failed, 'providers.removed')
      }
      if (removal.kind === 'key') hide(removal.slot.key)
      setRemoving(null)
    } catch (error) {
      toast.error(failureText(t, error))
    } finally {
      setBusy(false)
    }
    await load()
  }

  const keys = overview?.keys.filter((slot) => slot.preview) ?? []
  const accounts = overview?.accounts.filter((account) => account.signedIn) ?? []
  const empty = overview && overview.endpoints.length + keys.length + accounts.length === 0

  return (
    <>
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold text-foreground">{t('providers.title')}</h2>
          <Button disabled={!overview} onClick={() => setEditing('new')}>
            {t('providers.add')}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">{t('providers.hint')}</p>
        {problem ? (
          <div role="alert" className="text-base">
            <p>{problem}</p>
            <button className="mt-2 underline" onClick={() => void load()}>
              {t('roster.retry')}
            </button>
          </div>
        ) : !overview ? (
          <p role="status" className="text-sm text-muted-foreground">
            {t('providers.loading')}
          </p>
        ) : empty ? (
          <p className="text-base">{t('providers.empty')}</p>
        ) : (
          <ul className="space-y-2">
            {overview.endpoints.map((endpoint) => (
              <Row
                key={`endpoint:${endpoint.id}`}
                title={endpoint.name}
                badge={endpoint.is_current ? t('providers.active') : null}
                lines={[
                  endpoint.base_url,
                  t('providers.models').replace('{models}', endpoint.models.join(', '))
                ]}
              >
                <button className={linkClass} onClick={() => setEditing(endpoint)}>
                  {t('providers.edit')}
                </button>
                {canRemoveEndpoint(endpoint) && (
                  <button
                    className={linkClass}
                    onClick={() => setRemoving({ kind: 'endpoint', endpoint })}
                  >
                    {t('providers.remove')}
                  </button>
                )}
              </Row>
            ))}
            {keys.map((slot) => (
              <Row
                key={`key:${slot.provider}`}
                title={slot.provider}
                lines={[
                  revealed[slot.key] ??
                    t('providers.keySaved').replace('{preview}', slot.preview ?? '')
                ]}
                secret={revealed[slot.key] !== undefined}
              >
                <button className={linkClass} onClick={() => void reveal(slot)}>
                  {revealed[slot.key] !== undefined ? t('providers.hide') : t('providers.reveal')}
                </button>
                <button className={linkClass} onClick={() => setRemoving({ kind: 'key', slot })}>
                  {t('providers.remove')}
                </button>
              </Row>
            ))}
            {accounts.map((account) => (
              <Row
                key={`account:${account.id}`}
                title={account.name}
                badge={t('providers.signedIn')}
                lines={account.disconnectable ? [] : [t('providers.signedInElsewhere')]}
              >
                {account.disconnectable && (
                  <button
                    className={linkClass}
                    onClick={() => setRemoving({ kind: 'account', account })}
                  >
                    {t('providers.disconnect')}
                  </button>
                )}
              </Row>
            ))}
          </ul>
        )}

        {editing && overview && (
          <AddProviderDialog
            backend={backend}
            overview={overview}
            editing={editing === 'new' ? null : editing}
            onChanged={load}
            onClose={() => setEditing(null)}
          />
        )}
        <Dialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
          <DialogContent>
            {removing && <RemovalCopy removal={removing} />}
            <div className="flex gap-2">
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() => removing && void remove(removing)}
              >
                {removing?.kind === 'account' ? t('providers.disconnect') : t('providers.remove')}
              </Button>
              <Button variant="ghost" onClick={() => setRemoving(null)}>
                {t('roster.cancel')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </section>
      <DefaultModelSection
        key={loads}
        backend={backend}
        model={overview?.model ?? null}
        models={overview ? models : null}
        onChanged={load}
      />
    </>
  )
}

function Row({
  title,
  badge = null,
  lines,
  secret = false,
  children
}: {
  title: string
  badge?: string | null
  lines: string[]
  secret?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <li className="flex items-center gap-4 rounded-xl bg-secondary p-3">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-base font-medium">
          <span className="truncate">{title}</span>
          {badge && (
            <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-sm font-normal">
              {badge}
            </span>
          )}
        </p>
        {lines.map((line) => (
          <p
            key={line}
            className={
              secret
                ? 'font-mono text-sm break-all select-text'
                : 'truncate text-sm text-muted-foreground'
            }
          >
            {line}
          </p>
        ))}
      </div>
      <div className="flex shrink-0 gap-3">{children}</div>
    </li>
  )
}

function RemovalCopy({ removal }: { removal: Removal }): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [title, warning, name] =
    removal.kind === 'endpoint'
      ? ([
          'providers.removeEndpointTitle',
          'providers.removeEndpointWarning',
          removal.endpoint.name
        ] as const)
      : removal.kind === 'key'
        ? ([
            'providers.removeKeyTitle',
            'providers.removeKeyWarning',
            removal.slot.provider
          ] as const)
        : ([
            'providers.disconnectTitle',
            'providers.disconnectWarning',
            removal.account.name
          ] as const)
  return (
    <>
      <DialogTitle>{t(title).replace('{name}', name)}</DialogTitle>
      <DialogDescription>{t(warning)}</DialogDescription>
    </>
  )
}
