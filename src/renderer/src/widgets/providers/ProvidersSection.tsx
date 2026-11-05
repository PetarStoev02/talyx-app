import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
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
import type { TranslationKey } from '@shared/lib/i18n'
import { Button } from '@shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@shared/ui/dialog'
import type { ModelLists } from '@features/chat/chat'
import { AddProviderDialog } from './AddProviderDialog'
import { DefaultModelSection } from './DefaultModelSection'
import { Loading, Skeleton } from '@shared/ui/skeleton'
import { useArrival } from '@shared/hooks/useStayMounted'
import { cn } from '@shared/lib/utils'
import { failureText, reportSpread } from './feedback'

const linkClass =
  'text-sm underline underline-offset-4 hover:decoration-2 disabled:opacity-50 disabled:hover:decoration-1'

// Each confirm button names what it removes.
const CONFIRM: Record<Removal['kind'], TranslationKey> = {
  endpoint: 'providers.removeEndpoint',
  key: 'providers.removeKey',
  account: 'providers.disconnect'
}

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
  chat,
  onOverview
}: {
  backend: ProvidersBackend
  chat: ModelLists | null
  /** Told each overview that loads, e.g. so setup knows whether a provider exists. */
  onOverview: ((overview: ProvidersOverview) => void) | null
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [overview, setOverview] = useState<ProvidersOverview | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [editing, setEditing] = useState<CustomEndpoint | 'new' | null>(null)
  const [removing, setRemoving] = useState<Removal | null>(null)
  // A failed removal shows in its dialog: a toast would sit under the dialog, out of reach.
  const [removeProblem, setRemoveProblem] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const arrival = useArrival(!overview && !problem)
  // The latest callback, read at load time, so a new one each render does not reload the list.
  const reportOverview = useRef(onOverview)
  useLayoutEffect(() => {
    reportOverview.current = onOverview
  })

  const load = useCallback(
    (): Promise<void> =>
      loadProviders(backend).then(
        (next) => {
          setOverview(next)
          setProblem(null)
          reportOverview.current?.(next)
          // A revealed value may be stale now, and every model menu must load the new list.
          setRevealed({})
          chat?.forgetModels()
        },
        (error: unknown) => setProblem(failureText(t, error))
      ),
    [backend, t, chat]
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
      toast.error(failureText(t, error), { duration: Infinity })
    }
  }

  async function remove(removal: Removal): Promise<void> {
    setBusy(true)
    setRemoveProblem(null)
    try {
      if (removal.kind === 'account') {
        await disconnectAccount(backend, removal.account.id)
        toast.success(t('providers.signedOut'))
      } else {
        const failed =
          removal.kind === 'endpoint'
            ? await removeEndpoint(backend, removal.endpoint.id)
            : await removeKey(backend, removal.slot.key)
        reportSpread(t, failed, 'removed')
      }
      if (removal.kind === 'key') hide(removal.slot.key)
      setRemoving(null)
    } catch (error) {
      setRemoveProblem(failureText(t, error))
    } finally {
      setBusy(false)
    }
    await load()
  }

  function closeRemoval(): void {
    setRemoving(null)
    setRemoveProblem(null)
  }

  const keys = overview?.keys.filter((slot) => slot.preview) ?? []
  const accounts = overview?.accounts.filter((account) => account.signedIn) ?? []
  const empty = overview && overview.endpoints.length + keys.length + accounts.length === 0

  return (
    <>
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-foreground">{t('providers.title')}</h2>
          <Button disabled={!overview} onClick={() => setEditing('new')}>
            {t('providers.add')}
          </Button>
        </div>
        <p className="text-base">{t('providers.hint')}</p>
        {problem ? (
          <div role="alert" className="text-base">
            <p>{problem}</p>
            <button
              className="mt-2 underline underline-offset-4 hover:decoration-2"
              onClick={() => void load()}
            >
              {t('action.tryAgain')}
            </button>
          </div>
        ) : !overview ? (
          <Loading label={t('providers.loading')} className="space-y-2">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-16 w-full rounded-xl" />
            ))}
          </Loading>
        ) : empty ? (
          <div className="flex flex-col items-start gap-3 rounded-xl bg-secondary p-4">
            <p className="text-base">{t('providers.empty')}</p>
            <Button onClick={() => setEditing('new')}>{t('providers.add')}</Button>
          </div>
        ) : (
          <ul className={cn('space-y-2', arrival)}>
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
        <Dialog open={!!removing} onOpenChange={(open) => !open && closeRemoval()}>
          <DialogContent>
            {removing && <RemovalCopy removal={removing} />}
            {removeProblem && (
              <p role="alert" className="text-base text-destructive-text wrap-anywhere">
                {removeProblem}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() => removing && void remove(removing)}
              >
                {t(CONFIRM[removing?.kind ?? 'key'])}
              </Button>
              <Button variant="ghost" onClick={closeRemoval}>
                {t('roster.cancel')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </section>
      <DefaultModelSection
        backend={backend}
        model={overview?.model ?? null}
        models={overview && chat ? chat.models : null}
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
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-medium">
          <span className="min-w-0 wrap-break-word">{title}</span>
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
                : 'text-sm text-muted-foreground wrap-break-word'
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
