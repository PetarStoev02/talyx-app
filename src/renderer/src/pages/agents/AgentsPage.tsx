import { useMemo, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useRoster } from '@features/bots/store'
import { botTitle } from '@features/bots/roster'
import { BotAvatar } from '@widgets/roster'
import { TalyxLogo } from '@shared/ui/TalyxLogo'
import { ErrorBoundary } from '@app/ErrorBoundary'
import { useRefocus } from '@shared/hooks/useRefocus'
import { cn } from '@shared/lib/utils'
import { useLanguage } from '@app/providers/useLanguage'
import { EngineGate } from '@widgets/engine-gate'
import { ChatPane, ChatSkeleton, RoomPane } from '@widgets/chat'
import { RoomAvatars } from '@features/bots/RoomAvatars'
import { answering, roomActions } from '@features/chat/room'
import { useRooms } from '@features/chat/roomStore'
import { DetailsPanel, RoomDetailsPanel } from '@widgets/bot-details'
import type { ChatActions } from '@features/chat/chat'
import { SlidePanel } from '@shared/ui/Reveal'
import type { RosterBackend } from '@features/bots/data'

// Where the details and room panels sit: see their SlidePanel.
const PANEL_PLACE =
  'absolute inset-y-0 right-0 z-10 max-w-full shadow-xl @5xl:static @5xl:max-w-[50%] @5xl:shadow-none'

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
  const snapshot = useRoster((s) => s.snapshot)
  const selection = useRoster((s) => s.selection)
  const editingProfile = useRoster((s) => s.editingProfile)
  const loading = useRoster((s) => s.loading)
  const { editProfile } = useRoster.getState()
  // A chat opens by itself once the roster is in (useSelectionMemory); until then a placeholder.
  const opening = loading || snapshot.bots.some((item) => !item.meta.hidden)
  const bot = snapshot.bots.find((item) => selection?.kind === 'bot' && item.name === selection.id)
  const room = snapshot.rooms.find(
    (item) => selection?.kind === 'room' && item.room_id === selection.id
  )
  const phases = useRooms((state) => (room ? state.rooms[room.room_id]?.phases : undefined))
  const title = bot ? botTitle(bot) : room?.name
  const rooms = useMemo(() => roster && roomActions(roster), [roster])
  const pill = useRef<HTMLButtonElement>(null)
  // A room's panel stays open as you move between rooms, as a bot's does between bots.
  const [roomPanel, setRoomPanel] = useState(false)
  const detailsOpen = bot ? editingProfile === bot.name : !!room && roomPanel
  const toggleDetails = (): void => {
    if (bot) editProfile(editingProfile === bot.name ? null : bot.name)
    else setRoomPanel(!roomPanel)
  }
  // The panel closes with focus inside it; the pill that opened it takes it back.
  useRefocus(pill, detailsOpen)
  return (
    <EngineGate>
      {/* A container, so the details panel can tell when the page is too narrow to sit beside it. */}
      <div className="@container relative flex h-full min-w-0">
        <section
          aria-label={title ? t('agents.chatWith').replace('{name}', title) : t('nav.agents')}
          className="flex min-w-0 flex-1 flex-col"
        >
          {title && (
            <header className="flex min-h-16 shrink-0 items-center justify-center px-6 py-2">
              <button
                ref={pill}
                aria-expanded={detailsOpen}
                aria-label={t(bot ? 'agents.openDetails' : 'rooms.openDetails').replace(
                  '{name}',
                  title
                )}
                onClick={toggleDetails}
                className={cn(
                  pillClass,
                  'group transition-colors select-none hover:bg-foreground/10 aria-expanded:bg-foreground/10'
                )}
              >
                {bot ? (
                  <BotAvatar bot={bot} place="pill" />
                ) : (
                  room && (
                    <RoomAvatars
                      room={room}
                      bots={snapshot.bots}
                      size={20}
                      speaking={answering(room, phases)}
                    />
                  )
                )}
                {/* A room's name is shown nowhere else once it has messages: it wraps, never cuts off. */}
                <span className={bot ? 'truncate' : 'min-w-0 wrap-break-word'}>{title}</span>
                <ChevronRight
                  size={16}
                  aria-hidden="true"
                  className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-aria-expanded:rotate-180 group-aria-expanded:group-hover:-translate-x-0.5 motion-reduce:transition-none"
                />
              </button>
            </header>
          )}
          <ErrorBoundary key={bot?.name ?? room?.room_id ?? 'none'} scope="chat">
            {bot ? (
              <ChatPane key={bot.name} bot={bot} roster={roster} actions={chat} />
            ) : room ? (
              <RoomPane key={room.room_id} room={room} actions={rooms} chat={chat} />
            ) : opening ? (
              <ChatSkeleton label={t('chat.loading')} />
            ) : (
              <div className="grid flex-1 place-content-center justify-items-center gap-4 px-8 text-center">
                <TalyxLogo size={48} />
                <h1 className="text-2xl font-semibold">{t('agents.welcome')}</h1>
                <p className="max-w-sm text-base">{t('agents.chooseHint')}</p>
              </div>
            )}
          </ErrorBoundary>
        </section>
        {/* Beside the chat when the page has room for both; over it, from the right edge, when
            not. Either way it slides in and out. */}
        <SlidePanel value={roster && detailsOpen && bot} className={PANEL_PLACE}>
          {(shown) => (
            <ErrorBoundary key={shown.name} scope="details">
              <DetailsPanel bot={shown} backend={roster!} chat={chat} />
            </ErrorBoundary>
          )}
        </SlidePanel>
        <SlidePanel value={detailsOpen && room} className={PANEL_PLACE}>
          {(shown) => (
            <ErrorBoundary key={shown.room_id} scope="details">
              <RoomDetailsPanel room={shown} backend={roster} onClose={() => setRoomPanel(false)} />
            </ErrorBoundary>
          )}
        </SlidePanel>
      </div>
    </EngineGate>
  )
}
