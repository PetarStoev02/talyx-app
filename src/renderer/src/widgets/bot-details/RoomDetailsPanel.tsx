import { X } from 'lucide-react'
import { useLanguage } from '@app/providers/useLanguage'
import { BotAvatar } from '@features/bots/BotAvatar'
import { RoomAvatars } from '@features/bots/RoomAvatars'
import { botTitle } from '@features/bots/roster'
import { useRoster } from '@features/bots/store'
import type { Room } from '@features/bots/types'

// The room's members clustered in the hero square, as big as a bot's hero avatar.
const HERO_SIZE = 64

/** The third column for a room: who is in it. A member opens that bot's own chat. */
export function RoomDetailsPanel({
  room,
  onClose
}: {
  room: Room
  onClose: () => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const bots = useRoster((state) => state.snapshot.bots)
  const select = useRoster((state) => state.select)
  const count =
    room.members.length === 1
      ? t('roster.oneBot')
      : t('roster.bots').replace('{count}', String(room.members.length))
  return (
    <aside
      aria-label={t('rooms.details')}
      // Placed and slid in by the page (AgentsPage's SlidePanel); its own width never changes.
      className="tone-step flex h-full w-[340px] shrink-0 flex-col"
    >
      <header className="relative flex flex-col items-center gap-2 px-6 pt-6 pb-4 text-center">
        <button
          aria-label={t('agents.closeDetails')}
          onClick={onClose}
          className="absolute top-3 right-3 inline-flex size-9 items-center justify-center rounded-full hover:bg-foreground/10"
        >
          <X size={16} />
        </button>
        <RoomAvatars room={room} bots={bots} cluster={HERO_SIZE} />
        <h2 className="max-w-full text-xl font-semibold wrap-break-word">{room.name}</h2>
        <p className="text-sm text-muted-foreground">{count}</p>
      </header>
      <section aria-labelledby="room-members" className="scroll-y-stable min-h-0 flex-1 px-4 pb-4">
        <h3 id="room-members" className="px-2 pb-2 text-sm font-medium text-muted-foreground">
          {t('rooms.members')}
        </h3>
        <ul className="space-y-1">
          {room.members.map((member) => {
            const bot = bots.find((item) => item.name === member.profile)
            const name = bot ? botTitle(bot) : member.display_name || member.profile
            return (
              <li key={member.profile}>
                <button
                  // A member that left the roster has no chat here to open.
                  disabled={!bot}
                  onClick={() => select({ kind: 'bot', id: member.profile })}
                  className="flex w-full items-center gap-3 rounded-xl p-2 text-left text-base hover:bg-accent disabled:hover:bg-transparent"
                >
                  <BotAvatar bot={bot ?? { name: member.profile, meta: {} }} place="row" />
                  <span className="min-w-0 truncate">{name}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </aside>
  )
}
