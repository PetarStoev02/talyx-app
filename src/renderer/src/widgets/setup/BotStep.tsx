import { useLanguage } from '@app/providers/useLanguage'
import { CreateBotForm } from '@features/bots/CreateBotForm'
import type { RosterBackend } from '@features/bots/data'
import { useRosterConnection } from '@features/bots/useRosterConnection'
import type { ModelLists } from '@features/chat/chat'
import { ScreenTitle, Spinner } from '@features/setup/ScreenParts'
import { linkClass, panelClass } from '@features/setup/screenStyles'

/** Screen 9: the create-bot form, or straight on to Talyx. */
export function BotStep({
  roster,
  chat,
  onNext
}: {
  roster: RosterBackend | null
  chat: ModelLists | null
  onNext: () => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const skip = (
    <button type="button" className={linkClass} onClick={onNext}>
      {t('setup.skipBot')}
    </button>
  )

  return (
    <div className={panelClass}>
      <ScreenTitle level={2}>{t('setup.botTitle')}</ScreenTitle>
      <p className="text-base text-muted-foreground">{t('setup.botBody')}</p>
      {roster ? (
        <BotForm roster={roster} chat={chat} skip={skip} onCreated={onNext} />
      ) : (
        // The roster needs the engine's socket, which opens shortly after attaching.
        <>
          <p role="status" className="flex items-center gap-2 text-base text-foreground">
            <Spinner />
            {t('engine.connecting')}
          </p>
          {skip}
        </>
      )}
    </div>
  )
}

function BotForm({
  roster,
  chat,
  skip,
  onCreated
}: {
  roster: RosterBackend
  chat: ModelLists | null
  skip: React.ReactNode
  onCreated: () => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  // The roster widget is not on screen during setup; the form still needs the taken names.
  useRosterConnection(roster)
  return (
    <CreateBotForm
      backend={roster}
      models={chat?.models ?? null}
      initialFolderId={null}
      onCreated={onCreated}
      submitLabel={t('setup.makeBot')}
      secondary={skip}
    />
  )
}
