import { useState } from 'react'
import { DropdownMenu } from 'radix-ui'
import { Ellipsis, MessageSquare, Pencil, Plus, UserMinus, X } from 'lucide-react'
import { useLanguage } from '@app/providers/useLanguage'
import { runRosterMutation } from '@features/bots/actions'
import { BotAvatar } from '@features/bots/BotAvatar'
import type { RosterBackend } from '@features/bots/data'
import { ProblemMessage } from '@features/bots/ProblemMessage'
import {
  MAX_ROOM_MEMBERS,
  MIN_ROOM_MEMBERS,
  changeRoomMembers,
  renameRoom
} from '@features/bots/rooms'
import { RoomAvatars } from '@features/bots/RoomAvatars'
import { botTitle } from '@features/bots/roster'
import { useRoster } from '@features/bots/store'
import type { Bot, Room } from '@features/bots/types'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { BuiltEntries, ContextMenuArea, menuContentClass } from '@shared/ui/menu'
import type { MenuAction } from '@shared/ui/menu'

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
        <RoomMembers
          room={room}
          backend={backend}
          onOpen={(profile) => select({ kind: 'bot', id: profile })}
        />
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

/**
 * The room's bots. Each row's menu (right-click, or its dots) opens the bot's chat or removes it
 * from the room while two stay; Add a bot seats others, up to six. The room and its history stay.
 */
function RoomMembers({
  room,
  backend,
  onOpen
}: {
  room: Room
  backend: RosterBackend | null
  onOpen: (profile: string) => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const bots = useRoster((state) => state.snapshot.bots)
  const saving = useRoster((state) => state.saving)
  const error = useRoster((state) => state.actionError)
  const [adding, setAdding] = useState(false)
  const seated = room.members.map((member) => member.profile)
  const memberBots = room.members.map(
    (member) =>
      bots.find((bot) => bot.name === member.profile) ?? {
        name: member.profile,
        meta: {},
        display_name: member.display_name
      }
  )
  const candidates = bots.filter((bot) => !bot.meta.hidden && !seated.includes(bot.name))
  const change = (members: Bot[]): void => {
    if (!backend) return
    void runRosterMutation(backend, () =>
      changeRoomMembers(backend, { roomId: room.room_id, members })
    )
  }
  return (
    <>
      <ul className="space-y-1">
        {memberBots.map((bot) => {
          const known = bots.some((item) => item.name === bot.name)
          const name = known ? botTitle(bot) : bot.display_name || bot.name
          const actions = (): MenuAction[] => [
            {
              label: t('rooms.viewBot'),
              icon: MessageSquare,
              // A member that left the roster has no chat here to open.
              disabled: !known,
              onSelect: () => onOpen(bot.name)
            },
            {
              label: t('rooms.removeFromRoom'),
              icon: UserMinus,
              destructive: true,
              separated: true,
              disabled: !backend || saving || memberBots.length <= MIN_ROOM_MEMBERS,
              onSelect: () => change(memberBots.filter((item) => item.name !== bot.name))
            }
          ]
          return (
            <ContextMenuArea key={bot.name} actions={actions}>
              {/* Focusable, so the menu key and Shift+F10 open the same menu as a right-click. */}
              <li
                tabIndex={0}
                className="group flex items-center gap-3 rounded-xl p-2 text-base outline-none hover:bg-accent focus-visible:bg-accent"
              >
                <BotAvatar bot={bot} place="row" />
                <span className="min-w-0 flex-1 truncate">{name}</span>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger
                    aria-label={t('rooms.memberActions').replace('{name}', name)}
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-foreground/10 focus-visible:opacity-100 data-[state=open]:opacity-100"
                  >
                    <Ellipsis size={16} />
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content sideOffset={4} align="end" className={menuContentClass}>
                      <BuiltEntries build={actions} />
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </li>
            </ContextMenuArea>
          )
        })}
      </ul>
      {backend && memberBots.length < MAX_ROOM_MEMBERS && candidates.length > 0 && (
        <div className="pt-2">
          <button
            aria-expanded={adding}
            onClick={() => setAdding((open) => !open)}
            className="flex w-full items-center gap-3 rounded-xl p-2 text-left text-base text-muted-foreground hover:bg-accent"
          >
            <span className="inline-flex size-8 items-center justify-center">
              <Plus size={16} />
            </span>
            {t('rooms.addBot')}
          </button>
          {adding && (
            <ul className="space-y-1 pl-2">
              {candidates.map((bot) => (
                <li key={bot.name}>
                  <button
                    disabled={saving}
                    onClick={() => {
                      setAdding(false)
                      change([...memberBots, bot])
                    }}
                    className="flex w-full items-center gap-3 rounded-xl p-2 text-left text-base hover:bg-accent disabled:opacity-50"
                  >
                    <BotAvatar bot={bot} place="row" />
                    <span className="min-w-0 truncate">{botTitle(bot)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {error && (
        <div className="px-2 pt-2">
          <ProblemMessage problem={error} />
        </div>
      )}
      <p className="px-2 pt-3 text-sm text-muted-foreground">{t('rooms.membersHint')}</p>
    </>
  )
}
