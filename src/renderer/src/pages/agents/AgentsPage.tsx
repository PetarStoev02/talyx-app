import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import { useRoster } from '@features/bots/store'
import { botTitle } from '@features/bots/roster'
import { BotAvatar } from '@widgets/roster'
import { TalyxLogo } from '@shared/ui/TalyxLogo'
import { cn } from '@shared/lib/utils'
import { useLanguage } from '@app/providers/useLanguage'
import { EngineGate } from '@widgets/engine-gate'
import { ChatPane, RoomPane } from '@widgets/chat'
import { RoomAvatars } from '@features/bots/RoomAvatars'
import { roomActions } from '@features/chat/room'
import { DetailsPanel } from '@widgets/bot-details'
import type { ChatActions } from '@features/chat/chat'
import type { RosterBackend } from '@features/bots/data'

const pillClass =
  'flex max-w-full items-center gap-2 rounded-full bg-secondary px-4 py-2 text-base font-medium'

export function AgentsPage({
  chat,
  roster
}: {
  chat: ChatActions | null
  roster: RosterBackend | null
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const { snapshot, selection, editingProfile, editProfile } = useRoster()
  const bot = snapshot.bots.find((item) => selection?.kind === 'bot' && item.name === selection.id)
  const room = snapshot.rooms.find(
    (item) => selection?.kind === 'room' && item.room_id === selection.id
  )
  const title = bot ? botTitle(bot) : room?.name
  const rooms = useMemo(() => roster && roomActions(roster), [roster])
  return (
    <EngineGate>
      <div className="flex h-full min-w-0">
        <section
          aria-label={title ? t('agents.chatWith').replace('{name}', title) : t('nav.agents')}
          className="flex min-w-0 flex-1 flex-col"
        >
          {title && (
            <header className="flex h-16 shrink-0 items-center justify-center px-6">
              {bot ? (
                <button
                  aria-expanded={editingProfile === bot.name}
                  aria-label={t('agents.openDetails').replace('{name}', title)}
                  onClick={() => editProfile(editingProfile === bot.name ? null : bot.name)}
                  className={cn(
                    pillClass,
                    'group transition-colors select-none hover:bg-foreground/10 aria-expanded:bg-foreground/10'
                  )}
                >
                  <BotAvatar bot={bot} />
                  <span className="truncate">{title}</span>
                  <ChevronRight
                    size={16}
                    aria-hidden="true"
                    className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-aria-expanded:rotate-180 group-aria-expanded:group-hover:-translate-x-0.5 motion-reduce:transition-none"
                  />
                </button>
              ) : (
                <span className={pillClass}>
                  {room && <RoomAvatars room={room} bots={snapshot.bots} />}
                  <span className="truncate">{title}</span>
                </span>
              )}
            </header>
          )}
          {bot ? (
            <ChatPane
              key={bot.name}
              bot={bot}
              avatar={<BotAvatar bot={bot} size={64} />}
              actions={chat}
            />
          ) : room ? (
            <RoomPane
              key={room.room_id}
              room={room}
              actions={rooms}
              transcribe={chat && ((audio) => chat.transcribe('default', audio))}
            />
          ) : (
            <div className="grid flex-1 place-content-center justify-items-center gap-4 px-8 text-center">
              <TalyxLogo size={48} />
              <h1 className="text-2xl font-semibold">{t('agents.welcome')}</h1>
              <p className="max-w-sm text-base">{t('agents.chooseHint')}</p>
            </div>
          )}
        </section>
        {bot && roster && editingProfile === bot.name && (
          <DetailsPanel key={bot.name} bot={bot} backend={roster} models={chat?.models ?? null} />
        )}
      </div>
    </EngineGate>
  )
}
