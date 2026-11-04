import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useLanguage } from '@app/providers/useLanguage'
import { runRosterMutation } from '@features/bots/actions'
import { BotAvatar } from '@features/bots/BotAvatar'
import type { RosterBackend } from '@features/bots/data'
import { confirmModel, loadDetails, saveDetails } from '@features/bots/details'
import type {
  DetailsDraft,
  ModelChoice,
  ModelConfirm,
  ProfileDetails
} from '@features/bots/details'
import { ProblemMessage } from '@features/bots/ProblemMessage'
import { botTitle, problemOf } from '@features/bots/roster'
import type { RosterProblem } from '@features/bots/roster'
import { useRoster } from '@features/bots/store'
import type { Bot } from '@features/bots/types'
import type { ModelOptionProvider } from '@shared/engine/gateway-events'
import { cn } from '@shared/lib/utils'
import type { TranslationKey } from '@shared/lib/i18n'
import { Button } from '@shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@shared/ui/dialog'
import { ModelField } from '@shared/ui/ModelPicker'
import { RoutinesSection } from './RoutinesSection'

type Tab = 'details' | 'look' | 'soul'
const TABS: Array<[Tab, TranslationKey]> = [
  ['details', 'details.tabDetails'],
  ['look', 'details.tabLook'],
  ['soul', 'details.tabSoul']
]
const fieldClass = 'mt-2 block w-full rounded-lg bg-secondary px-3 py-2 text-base'

export type ModelOptions = (profile: string) => Promise<ModelOptionProvider[]>

/** The third column for one bot. Edits stay here until Save; Cancel drops them. */
export function DetailsPanel({
  bot,
  backend,
  models
}: {
  bot: Bot
  backend: RosterBackend
  models: ModelOptions | null
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const editProfile = useRoster((s) => s.editProfile)
  const saving = useRoster((s) => s.saving)
  const error = useRoster((s) => s.error)
  const [tab, setTab] = useState<Tab>('details')
  const [loaded, setLoaded] = useState<ProfileDetails | null>(null)
  const [loadError, setLoadError] = useState<RosterProblem | null>(null)
  const [title, setTitle] = useState(bot.meta.title ?? '')
  const [fields, setFields] = useState<ProfileDetails | null>(null)
  const [confirm, setConfirm] = useState<ModelConfirm | null>(null)
  const [attempt, setAttempt] = useState(0)
  const opening: DetailsDraft | null = loaded && { title: bot.meta.title ?? '', ...loaded }
  const draft: DetailsDraft | null = fields && { title, ...fields }

  useEffect(() => {
    let current = true
    useRoster.getState().clearError()
    loadDetails(backend, bot.name)
      .then((details) => {
        if (!current) return
        setLoaded(details)
        setFields(details)
      })
      .catch((failure: unknown) => current && setLoadError(problemOf(failure)))
    return () => {
      current = false
    }
  }, [backend, bot.name, attempt])

  const changed =
    !!draft &&
    !!opening &&
    (draft.title.trim() !== opening.title.trim() ||
      draft.description.trim() !== opening.description.trim() ||
      draft.soul !== opening.soul ||
      (!!draft.model &&
        (draft.model.model !== opening.model?.model ||
          draft.model.provider !== opening.model?.provider)))

  function save(): void {
    if (!draft || !opening) return
    void runRosterMutation(backend, async () => {
      const asked = await saveDetails(backend, bot, { opening, draft })
      if (!asked) return closeIfShowing()
      // Everything but the model is saved; the panel now opens from there.
      setLoaded({ ...draft, model: opening.model })
      setConfirm(asked)
    })
  }

  function applyModel(model: ModelChoice): void {
    void runRosterMutation(backend, async () => {
      await confirmModel(backend, bot.name, model)
      setConfirm(null)
      closeIfShowing()
    })
  }

  // A save can finish after the user moved to another bot's panel; that panel stays open.
  function closeIfShowing(): void {
    if (useRoster.getState().editingProfile === bot.name) editProfile(null)
  }

  // Declining keeps the model the engine has, in the field as well.
  function keepModel(): void {
    setConfirm(null)
    setFields((value) => value && { ...value, model: loaded?.model ?? null })
  }

  const update = (patch: Partial<ProfileDetails>): void =>
    setFields((value) => value && { ...value, ...patch })

  return (
    <aside
      aria-label={t('agents.details')}
      className="flex w-[340px] max-w-[50%] shrink-0 flex-col border-l bg-card"
    >
      <header className="relative flex flex-col items-center gap-2 px-6 pt-6 pb-4 text-center">
        <button
          aria-label={t('agents.closeDetails')}
          onClick={() => editProfile(null)}
          className="absolute top-3 right-3 rounded-full p-2 hover:bg-accent"
        >
          <X size={16} />
        </button>
        <BotAvatar bot={bot} size={64} />
        <h2 className="text-xl font-semibold">{botTitle(bot)}</h2>
        <p className="text-sm text-muted-foreground">
          {[
            loaded?.description,
            loaded?.model && `${loaded.model.provider} · ${loaded.model.model}`
          ]
            .filter(Boolean)
            .join(' · ') || bot.name}
        </p>
      </header>
      <div
        role="tablist"
        aria-label={t('details.sections')}
        className="mx-6 flex rounded-full bg-secondary p-1"
      >
        {TABS.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              'flex-1 rounded-full px-3 py-1.5 text-sm font-medium',
              tab === id ? 'bg-card' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t(label)}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-4">
        {loadError ? (
          <div role="alert">
            <ProblemMessage problem={loadError} />
            <button
              className="mt-2 underline"
              onClick={() => {
                setLoadError(null)
                setAttempt((n) => n + 1)
              }}
            >
              {t('roster.retry')}
            </button>
          </div>
        ) : !draft ? (
          <p role="status">{t('details.loading')}</p>
        ) : tab === 'details' ? (
          <div className="space-y-4">
            {bot.name !== 'default' && (
              <label className="block text-base">
                {t('details.title')}
                <input
                  value={draft.title}
                  maxLength={100}
                  placeholder={botTitle({ ...bot, meta: { ...bot.meta, title: undefined } })}
                  onChange={(event) => setTitle(event.target.value)}
                  className={fieldClass}
                />
              </label>
            )}
            <label className="block text-base">
              {t('details.description')}
              <textarea
                value={draft.description}
                rows={3}
                placeholder={t('details.descriptionHint')}
                onChange={(event) => update({ description: event.target.value })}
                className={cn(fieldClass, 'resize-none')}
              />
            </label>
            <div className="text-base">
              {t('details.model')}
              <ModelField
                labels={{
                  field: t('details.model'),
                  empty: t('details.modelDefault'),
                  loading: t('chat.modelsLoading')
                }}
                value={draft.model}
                load={models && (() => models(bot.name))}
                onSelect={(model) => update({ model })}
              />
            </div>
            <RoutinesSection bot={bot} backend={backend} />
          </div>
        ) : tab === 'look' ? (
          <p className="text-base">{t('details.lookSoon')}</p>
        ) : (
          <label className="flex flex-1 flex-col text-base">
            {t('details.soul')}
            <textarea
              value={draft.soul}
              spellCheck={false}
              onChange={(event) => update({ soul: event.target.value })}
              className={cn(fieldClass, 'min-h-64 flex-1 resize-none font-mono text-sm')}
            />
          </label>
        )}
      </div>
      {error && (
        <div role="alert" className="px-6 pb-2">
          <ProblemMessage problem={error} />
        </div>
      )}
      <footer className="flex justify-end gap-2 border-t px-6 py-3">
        <Button
          variant="ghost"
          className="rounded-full text-base"
          onClick={() => editProfile(null)}
        >
          {t('roster.cancel')}
        </Button>
        <Button className="rounded-full text-base" disabled={!changed || saving} onClick={save}>
          {saving ? t('details.saving') : t('details.save')}
        </Button>
      </footer>
      <Dialog open={!!confirm} onOpenChange={(open) => !open && keepModel()}>
        <DialogContent className="border-0 bg-card shadow-none backdrop-blur-none">
          <DialogTitle>{t('details.confirmTitle')}</DialogTitle>
          <DialogDescription>{confirm?.message}</DialogDescription>
          {error && (
            <div role="alert">
              <ProblemMessage problem={error} />
            </div>
          )}
          <div className="flex gap-2">
            <Button
              className="rounded-full text-base"
              disabled={saving}
              onClick={() => confirm && applyModel(confirm.model)}
            >
              {t('details.confirmUse')}
            </Button>
            <Button variant="ghost" className="rounded-full text-base" onClick={keepModel}>
              {t('details.confirmKeep')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </aside>
  )
}
