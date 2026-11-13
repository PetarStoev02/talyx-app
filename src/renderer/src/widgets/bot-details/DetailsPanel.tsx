import { useEffect, useState } from 'react'
import { Tabs } from 'radix-ui'
import { X } from 'lucide-react'
import { useLanguage } from '@app/providers/useLanguage'
import { runRosterMutation } from '@features/bots/actions'
import { BotAvatar } from '@features/bots/BotAvatar'
import type { RosterBackend } from '@features/bots/data'
import {
  MANAGER,
  SectionsNotSavedError,
  confirmModel,
  followDefault,
  loadDetails,
  refusedSectionProblem,
  sameModelChoice,
  saveDetails
} from '@features/bots/details'
import type {
  DetailsDraft,
  ModelChoice,
  ModelConfirm,
  ProfileDetails
} from '@features/bots/details'
import { lookOf, sameLook } from '@features/bots/look'
import { LookPicker } from '@features/bots/LookPicker'
import { ProblemMessage } from '@features/bots/ProblemMessage'
import { botTitle, problemOf } from '@features/bots/roster'
import { reportSpread } from '@features/bots/spread'
import type { RosterProblem } from '@features/bots/roster'
import { useRoster } from '@features/bots/store'
import type { Bot } from '@features/bots/types'
import type { ChatActions } from '@features/chat/chat'
import { useChat } from '@features/chat/store'
import type { TranslationKey } from '@shared/lib/i18n'
import { Button } from '@shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@shared/ui/dialog'
import { Input, Textarea } from '@shared/ui/input'
import { ModelField } from '@shared/ui/ModelPicker'
import { Loading, Skeleton } from '@shared/ui/skeleton'
import { useArrival } from '@shared/hooks/useStayMounted'
import { cn } from '@shared/lib/utils'
import { RoutinesSection } from './RoutinesSection'

type Tab = 'details' | 'look' | 'soul'
const TABS: Array<[Tab, TranslationKey]> = [
  ['details', 'details.tabDetails'],
  ['look', 'details.tabLook'],
  ['soul', 'details.tabSoul']
]

// The tab that holds each section's field, where its refusal shows.
const SECTION_TABS: Record<string, Tab> = { description: 'details', model: 'details', soul: 'soul' }

/** What the panel needs of the chat: the model lists, and the open chat's model switch. */
export type ChatModels = Pick<ChatActions, 'models' | 'setModel'>

/** The third column for one bot. Edits stay here until Save; Cancel drops them. */
export function DetailsPanel({
  bot,
  backend,
  chat
}: {
  bot: Bot
  backend: RosterBackend
  chat: ChatModels | null
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const editProfile = useRoster((s) => s.editProfile)
  const saving = useRoster((s) => s.saving)
  const error = useRoster((s) => s.actionError)
  const [tab, setTab] = useState<Tab>('details')
  const [loaded, setLoaded] = useState<ProfileDetails | null>(null)
  const [loadError, setLoadError] = useState<RosterProblem | null>(null)
  const [title, setTitle] = useState(bot.meta.title ?? '')
  const [look, setLook] = useState(() => lookOf(bot))
  const [usesDefault, setUsesDefault] = useState(bot.meta.usesDefault === true)
  // Talyx's model, which "Uses default" stands for; null for Talyx itself, or when it has none.
  const [defaultModel, setDefaultModel] = useState<ModelChoice | null>(null)
  const [fields, setFields] = useState<ProfileDetails | null>(null)
  const [confirm, setConfirm] = useState<ModelConfirm | null>(null)
  const [attempt, setAttempt] = useState(0)
  // Sections the engine refused in the last save; each shows its reason under its field.
  const [refused, setRefused] = useState<string[]>([])
  const [refusedReason, setRefusedReason] = useState<string | null>(null)
  const opening: DetailsDraft | null = loaded && {
    title: bot.meta.title ?? '',
    look: lookOf(bot),
    usesDefault: bot.meta.usesDefault === true,
    ...loaded
  }
  const draft: DetailsDraft | null = fields && { title, look, usesDefault, ...fields }
  const arrival = useArrival(!draft && !loadError)

  useEffect(() => {
    let current = true
    Promise.all([
      loadDetails(backend, bot.name),
      bot.name === MANAGER ? null : loadDetails(backend, MANAGER)
    ])
      .then(([details, talyx]) => {
        if (!current) return
        setLoaded(details)
        setFields(details)
        setDefaultModel(talyx?.model ?? null)
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
      !sameLook(draft.look, opening.look) ||
      draft.description.trim() !== opening.description.trim() ||
      draft.soul !== opening.soul ||
      draft.usesDefault !== opening.usesDefault ||
      (!!draft.model && !sameModelChoice(draft.model, opening.model)))

  function save(): void {
    if (!draft || !opening) return
    setRefused([])
    void runRosterMutation(backend, async () => {
      const asked = await saveOrMarkRefused(draft, opening)
      if (asked === undefined) return
      if (!asked) {
        if (draft.model && !sameModelChoice(draft.model, opening.model))
          await modelChanged(draft.model)
        return closeIfShowing()
      }
      // Everything but the model is saved; the panel now opens from there.
      setLoaded({ ...draft, model: opening.model })
      setConfirm(asked)
    })
  }

  // A refusal shows under its field, on that field's tab; the general line below the panel joins
  // it when several sections failed or one has no field. Resolves undefined when a field was
  // refused.
  async function saveOrMarkRefused(
    draft: DetailsDraft,
    opening: DetailsDraft
  ): Promise<ModelConfirm | null | undefined> {
    try {
      return await saveDetails(backend, bot, { opening, draft })
    } catch (error) {
      if (!(error instanceof SectionsNotSavedError)) throw error
      setRefused(error.sections)
      setRefusedReason(error.reason)
      const [only, ...others] = error.sections
      if (others.length > 0 || !SECTION_TABS[only]) throw error
      setTab(SECTION_TABS[only])
      return undefined
    }
  }

  function fieldProblem(section: string): React.JSX.Element | null {
    return refused.includes(section) ? (
      <ProblemMessage problem={refusedSectionProblem(section, refusedReason)} />
    ) : null
  }

  function applyModel(model: ModelChoice): void {
    void runRosterMutation(backend, async () => {
      await confirmModel(backend, bot.name, model)
      await modelChanged(model)
      setConfirm(null)
      closeIfShowing()
    })
  }

  // The engine's pin is for new sessions; the bot's open chat switches too, as from its composer,
  // so its model chip agrees with the bot. With no chat yet, the first one starts on the pin.
  // Talyx's model is the default: the bots on "Uses default" move with it.
  async function modelChanged(model: ModelChoice): Promise<void> {
    if (useChat.getState().chats[bot.name]?.sessionId) void chat?.setModel(bot.name, model)
    if (bot.name === MANAGER) reportSpread(t, await followDefault(backend, model), 'followed')
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
      // Placed and slid in by the page (AgentsPage's SlidePanel); its own width never changes.
      className="tone-step flex h-full w-[340px] shrink-0 flex-col"
    >
      <header className="relative flex flex-col items-center gap-2 px-6 pt-6 pb-4 text-center">
        <button
          aria-label={t('agents.closeDetails')}
          onClick={() => editProfile(null)}
          className="absolute top-3 right-3 inline-flex size-9 items-center justify-center rounded-full hover:bg-foreground/10"
        >
          <X size={16} />
        </button>
        <BotAvatar bot={bot} place="hero" />
        <h2 className="max-w-full text-xl font-semibold wrap-break-word">{botTitle(bot)}</h2>
        {/* What it does, then its model on a line of its own. */}
        <p className="text-sm text-balance text-muted-foreground">
          {loaded?.description || (!loaded?.model && bot.name)}
          {loaded?.model && (
            <span className="block text-xs">
              {loaded.model.provider} · {loaded.model.model}
            </span>
          )}
        </p>
      </header>
      <Tabs.Root
        value={tab}
        onValueChange={(value) => setTab(value as Tab)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <Tabs.List
          aria-label={t('details.sections')}
          className="mx-6 flex rounded-full bg-secondary p-1"
        >
          {TABS.map(([id, label]) => (
            <Tabs.Trigger
              key={id}
              value={id}
              className="flex-1 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background"
            >
              {t(label)}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        {/* One panel for the selected tab; Radix names it after its tab. */}
        <Tabs.Content
          value={tab}
          className={cn('scroll-y-stable flex min-h-0 flex-1 flex-col px-6 py-4', arrival)}
        >
          {loadError ? (
            <div>
              <ProblemMessage problem={loadError} />
              <button
                className="mt-2 underline underline-offset-4 hover:decoration-2"
                onClick={() => {
                  setLoadError(null)
                  setAttempt((n) => n + 1)
                }}
              >
                {t('action.tryAgain')}
              </button>
            </div>
          ) : !draft ? (
            <Loading label={t('details.loading')} className="space-y-5">
              {[0, 1, 2].map((field) => (
                <div key={field} className="space-y-2">
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </Loading>
          ) : tab === 'details' ? (
            <div className="space-y-4">
              {bot.name !== 'default' && (
                <label className="block text-base">
                  {t('details.title')}
                  <Input
                    value={draft.title}
                    maxLength={100}
                    placeholder={botTitle({ ...bot, meta: { ...bot.meta, title: undefined } })}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </label>
              )}
              <label className="block text-base">
                {t('details.description')}
                <Textarea
                  value={draft.description}
                  rows={3}
                  placeholder={t('details.descriptionHint')}
                  onChange={(event) => update({ description: event.target.value })}
                />
              </label>
              {fieldProblem('description')}
              <div className="text-base">
                {t('details.model')}
                <ModelField
                  labels={{
                    field: t('details.model'),
                    empty: t('details.modelDefault'),
                    loading: t('chat.modelsLoading'),
                    failed: t('chat.modelsFailed')
                  }}
                  value={draft.model}
                  // Talyx's models, as in the New bot dialog: a bot moved off a custom endpoint no
                  // longer lists it, and the pin brings the endpoint along.
                  load={chat && (() => chat.models(MANAGER))}
                  onSelect={(model) => {
                    setUsesDefault(false)
                    update({ model })
                  }}
                  standIn={
                    defaultModel && {
                      label: t('details.usesDefault').replace('{model}', defaultModel.model),
                      selected: draft.usesDefault,
                      onSelect: () => {
                        setUsesDefault(true)
                        update({ model: defaultModel })
                      }
                    }
                  }
                />
                <span className="mt-1 block text-sm text-muted-foreground">
                  {t(bot.name === MANAGER ? 'details.modelHintTalyx' : 'details.modelHint')}
                </span>
                {fieldProblem('model')}
              </div>
              <RoutinesSection bot={bot} backend={backend} />
            </div>
          ) : tab === 'look' ? (
            <LookPicker look={draft.look} profile={bot.name} onChange={setLook} />
          ) : (
            <>
              <label className="flex flex-1 flex-col text-base">
                {t('details.soul')}
                <Textarea
                  value={draft.soul}
                  spellCheck={false}
                  onChange={(event) => update({ soul: event.target.value })}
                  className="min-h-64 flex-1"
                />
              </label>
              {fieldProblem('soul')}
            </>
          )}
        </Tabs.Content>
      </Tabs.Root>
      {error && (
        <div className="px-6 pb-2">
          <ProblemMessage problem={error} />
        </div>
      )}
      {/* Primary first, as in every dialog. */}
      <footer className="flex gap-2 px-6 py-3">
        <Button disabled={!changed || saving} onClick={save}>
          {saving ? t('details.saving') : t('details.save')}
        </Button>
        <Button variant="ghost" onClick={() => editProfile(null)}>
          {t('roster.cancel')}
        </Button>
      </footer>
      <Dialog open={!!confirm} onOpenChange={(open) => !open && keepModel()}>
        <DialogContent>
          <DialogTitle>{t('details.confirmTitle')}</DialogTitle>
          <DialogDescription>{confirm?.message}</DialogDescription>
          {error && <ProblemMessage problem={error} />}
          <div className="flex gap-2">
            <Button disabled={saving} onClick={() => confirm && applyModel(confirm.model)}>
              {t('details.confirmUse')}
            </Button>
            <Button variant="ghost" onClick={keepModel}>
              {t('details.confirmKeep')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </aside>
  )
}
