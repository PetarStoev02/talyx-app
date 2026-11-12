import { useState } from 'react'
import { Pencil, X } from 'lucide-react'
import { useLanguage } from '@app/providers/useLanguage'
import { runRosterMutation } from '@features/bots/actions'
import { BotAvatar } from '@features/bots/BotAvatar'
import type { RosterBackend } from '@features/bots/data'
import { ProblemMessage } from '@features/bots/ProblemMessage'
import { renameRoom } from '@features/bots/rooms'
import { RoomAvatars } from '@features/bots/RoomAvatars'
import { botTitle } from '@features/bots/roster'
import { useRoster } from '@features/bots/store'
import type { Room } from '@features/bots/types'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'

// The room's members clustered in the hero square, as big as a bot's hero avatar.
const HERO_SIZE = 64

/** The third column for a room: its name and who is in it. A member opens that bot's own chat. */
export function RoomDetailsPanel({
  room,
  backend,
  onClose
}: {
  room: Room
  /** Null while the engine is not attached: the name shows but cannot change. */
  backend: RosterBackend | null
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
        <RoomName room={room} backend={backend} />
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
        <p className="px-2 pt-3 text-sm text-muted-foreground">{t('rooms.fixedMembers')}</p>
      </section>
    </aside>
  )
}

/** The room's name; the pencil turns it into a field. Enter saves, Escape leaves it as it was. */
function RoomName({
  room,
  backend
}: {
  room: Room
  backend: RosterBackend | null
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const saving = useRoster((state) => state.saving)
  const error = useRoster((state) => state.actionError)
  const { clearError } = useRoster.getState()
  const [name, setName] = useState<string | null>(null)
  const stop = (): void => {
    clearError()
    setName(null)
  }
  async function save(): Promise<void> {
    if (!backend || name === null) return
    if (name.trim() === room.name) return stop()
    await runRosterMutation(backend, () => renameRoom(backend, { roomId: room.room_id, name }))
    // A failed rename keeps the field open with the engine's words under it.
    if (!useRoster.getState().actionError) setName(null)
  }
  if (name === null)
    return (
      <div className="flex max-w-full items-center gap-1">
        <h2 className="min-w-0 text-xl font-semibold wrap-break-word">{room.name}</h2>
        {backend && (
          <button
            aria-label={t('rooms.rename')}
            onClick={() => {
              clearError()
              setName(room.name)
            }}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/10"
          >
            <Pencil size={14} />
          </button>
        )}
      </div>
    )
  return (
    <form
      className="w-full space-y-2 text-left"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <label className="block text-sm text-muted-foreground">
        {t('rooms.name')}
        <Input
          autoFocus
          value={name}
          disabled={saving}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation()
              stop()
            }
          }}
        />
      </label>
      {error && <ProblemMessage problem={error} />}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={stop}>
          {t('roster.cancel')}
        </Button>
        <Button type="submit" disabled={saving || !name.trim()}>
          {t('details.save')}
        </Button>
      </div>
    </form>
  )
}
