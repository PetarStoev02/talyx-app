import { useRoster } from '@features/bots/store'
import { botTitle } from '@features/bots/roster'
import { BotAvatar } from '@widgets/roster'
import { TalyxLogo } from '@shared/ui/TalyxLogo'
import { useLanguage } from '@app/providers/useLanguage'
import { EngineGate } from '@widgets/engine-gate'
import { ChatPane } from '@widgets/chat'
import type { ChatActions } from '@features/chat/chat'

export function AgentsPage({ chat }: { chat: ChatActions | null }): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const { snapshot, selection, editingProfile, editProfile } = useRoster()
  const bot = snapshot.bots.find((item) => selection?.kind === 'bot' && item.name === selection.id)
  const room = snapshot.rooms.find(
    (item) => selection?.kind === 'room' && item.room_id === selection.id
  )
  const title = bot ? botTitle(bot) : room?.name
  return (
    <EngineGate>
      <div className="flex h-full min-w-0">
        <section
          aria-label={title ? t('agents.chatWith').replace('{name}', title) : t('nav.agents')}
          className="flex min-w-0 flex-1 flex-col"
        >
          {title && (
            <header className="flex h-16 shrink-0 items-center px-6">
              <span className="flex max-w-full items-center gap-2 rounded-full bg-secondary px-4 py-2 text-base font-medium">
                {bot && <BotAvatar bot={bot} />}
                <span className="truncate">{title}</span>
              </span>
            </header>
          )}
          {bot ? (
            <ChatPane
              key={bot.name}
              bot={bot}
              avatar={<BotAvatar bot={bot} size={64} />}
              actions={chat}
            />
          ) : (
            <div className="grid flex-1 place-content-center justify-items-center gap-4 px-8 text-center">
              <TalyxLogo size={48} />
              <h1 className="text-2xl font-semibold">{title || t('agents.welcome')}</h1>
              <p className="max-w-sm text-base">
                {title ? t('agents.roomSoon') : t('agents.chooseHint')}
              </p>
            </div>
          )}
        </section>
        {bot && editingProfile === bot.name && (
          <aside
            aria-label={t('agents.details')}
            className="w-[340px] max-w-[50%] shrink-0 bg-secondary p-6"
          >
            <button className="mb-6 underline" onClick={() => editProfile(null)}>
              {t('agents.closeDetails')}
            </button>
            <h2 className="text-xl font-semibold">{botTitle(bot)}</h2>
            <p className="mt-3 text-base">
              {bot.meta.description || bot.description || t('agents.noDescription')}
            </p>
            <p className="mt-6 text-base">{t('agents.editingSoon')}</p>
          </aside>
        )}
      </div>
    </EngineGate>
  )
}
