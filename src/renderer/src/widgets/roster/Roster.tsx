import { useState } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { useLanguage } from '@app/providers/useLanguage'
import { useRosterConnection } from '@features/bots/useRosterConnection'
import type { RosterBackend } from '@features/bots/data'
import { rosterActions, runRosterMutation } from '@features/bots/actions'
import { botTitle, pinnedBots } from '@features/bots/roster'
import { useRoster } from '@features/bots/store'
import type { Bot, Room } from '@features/bots/types'
import { BotRow } from './BotRow'
import { FolderGroup } from './FolderGroup'
import { ProblemMessage } from '@features/bots/ProblemMessage'
import type { ModelOptionProvider } from '@shared/engine/gateway-events'
import { CreateBotDialog } from './CreateBotDialog'
import { CreateRoomDialog } from './CreateRoomDialog'
import { DeleteProfileDialog, DeleteRoomDialog, NewFolderDialog } from './RosterDialogs'
import { rosterControls } from './rosterControls'
import { RosterMenu } from './RosterMenu'
import type { MenuAction } from './RosterMenu'

// `backend` must be a stable reference (see useRosterConnection).
export function Roster({
  backend,
  models,
  onSelect
}: {
  backend: RosterBackend
  models: ((profile: string) => Promise<ModelOptionProvider[]>) | null
  onSelect: () => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const state = useRoster()
  const [newFolder, setNewFolder] = useState(false)
  const [newBot, setNewBot] = useState(false)
  const [newRoom, setNewRoom] = useState(false)
  const [deleting, setDeleting] = useState<Bot | null>(null)
  const [deletingRoom, setDeletingRoom] = useState<Room | null>(null)
  useRosterConnection(backend)
  const actions = rosterActions(backend)
  const run = (operation: () => Promise<void>): void => {
    void runRosterMutation(backend, operation)
  }
  // Every mutation re-reads the roster afterwards, so a reload is an empty mutation.
  const reload = (): void => run(() => Promise.resolve())
  const selectBot = (bot: Bot): void => {
    state.select({ kind: 'bot', id: bot.name })
    onSelect()
  }
  const selectRoom = (room: Room): void => {
    state.select({ kind: 'room', id: room.room_id })
    onSelect()
  }
  const { botActions, roomActions, folderActions, dropOnFolder } = rosterControls({
    actions,
    run,
    selectBot,
    setDeleting: (bot) => {
      state.clearError()
      setDeleting(bot)
    },
    setDeletingRoom: (room) => {
      state.clearError()
      setDeletingRoom(room)
    },
    t
  })
  const dialogOpen = !!deleting || !!deletingRoom || newFolder || newBot || newRoom
  return (
    <nav
      aria-label={t('roster.label')}
      aria-busy={state.loading || state.saving}
      className="min-h-0 flex-1 overflow-y-auto px-3"
    >
      <TallyLine />
      {!dialogOpen && <ProblemBanner retry={reload} />}
      {state.loading && (
        <p role="status" className="p-2">
          {t('roster.loading')}
        </p>
      )}
      <PinnedGrid
        botActions={botActions}
        selectBot={selectBot}
        orderPin={(from, to) => run(() => actions.orderPin(from, to))}
      />
      <FoldersHeader
        reload={reload}
        newFolder={() => {
          state.clearError()
          setNewFolder(true)
        }}
        newBot={() => {
          state.clearError()
          setNewBot(true)
        }}
        newRoom={() => {
          state.clearError()
          setNewRoom(true)
        }}
      />
      {[...state.snapshot.folders.filter((folder) => !folder.parentId), null].map((folder) => (
        <FolderGroup
          key={folder?.id ?? 'unassigned'}
          folder={folder}
          botActions={botActions}
          folderActions={folderActions}
          selectBot={selectBot}
          selectRoom={selectRoom}
          dropOnFolder={dropOnFolder}
          roomActions={roomActions}
        />
      ))}
      <HiddenAgents restore={(bot) => run(() => actions.hide(bot))} />
      {newFolder && (
        <NewFolderDialog
          onClose={() => setNewFolder(false)}
          onCreate={(name) =>
            run(async () => {
              await actions.addFolder(name)
              setNewFolder(false)
            })
          }
        />
      )}
      {newBot && (
        <CreateBotDialog backend={backend} models={models} onClose={() => setNewBot(false)} />
      )}
      {newRoom && <CreateRoomDialog backend={backend} onClose={() => setNewRoom(false)} />}
      <DeleteRoomDialog
        room={deletingRoom}
        onClose={() => setDeletingRoom(null)}
        onDelete={(room) =>
          run(async () => {
            await actions.deleteRoom(room)
            setDeletingRoom(null)
          })
        }
      />
      <DeleteProfileDialog
        bot={deleting}
        onClose={() => setDeleting(null)}
        onDelete={(bot) =>
          run(async () => {
            await actions.deleteProfile(bot)
            setDeleting(null)
          })
        }
      />
    </nav>
  )
}

function ProblemBanner({ retry }: { retry: () => void }): React.JSX.Element | null {
  const t = useLanguage((s) => s.t)
  const error = useRoster((state) => state.error)
  if (!error) return null
  return (
    <div role="alert" className="rounded-xl bg-secondary p-3 text-base">
      <ProblemMessage problem={error} />
      <button className="mt-2 underline" onClick={retry}>
        {t('roster.retry')}
      </button>
    </div>
  )
}

function FoldersHeader({
  reload,
  newFolder,
  newBot,
  newRoom
}: {
  reload: () => void
  newFolder: () => void
  newBot: () => void
  newRoom: () => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const saving = useRoster((state) => state.saving)
  return (
    <div className="mt-4 flex items-center justify-between px-2">
      <span className="text-base font-medium">{t('roster.folders')}</span>
      <span className="flex gap-1">
        <button
          aria-label={t('roster.refresh')}
          disabled={saving}
          onClick={reload}
          className="rounded-full p-2 hover:bg-accent"
        >
          <RefreshCw size={16} />
        </button>
        <RosterMenu
          label={t('roster.add')}
          disabled={saving}
          icon={<Plus size={18} />}
          actions={[
            { label: t('create.title'), onSelect: newBot },
            { label: t('roster.newRoom'), onSelect: newRoom },
            { label: t('roster.newFolder'), onSelect: newFolder }
          ]}
        />
      </span>
    </div>
  )
}

// "Waiting on you" counts a bot that asked for input or has a reply the user has not opened.
function TallyLine(): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const bots = useRoster((state) => state.snapshot.bots)
  const activity = useRoster((state) => state.activity)
  const unread = useRoster((state) => state.unread)
  const visible = bots.filter((bot) => !bot.meta.hidden)
  const waiting = visible.filter((bot) => activity[bot.name] === 'waiting' || unread[bot.name])
  const working = visible.filter((bot) => activity[bot.name] === 'working')
  return (
    <p className="px-2 py-3 text-base">
      {t('roster.tally')
        .replace('{agents}', String(visible.length))
        .replace('{waiting}', String(waiting.length))
        .replace('{working}', String(working.length))}
    </p>
  )
}

// Up to three pins show as large tiles; a fourth switches the grid to four small ones.
function PinnedGrid({
  botActions,
  selectBot,
  orderPin
}: {
  botActions: (bot: Bot) => MenuAction[]
  selectBot: (bot: Bot) => void
  orderPin: (from: string, to: string) => void
}): React.JSX.Element {
  const bots = useRoster((state) => state.snapshot.bots)
  const pins = pinnedBots(bots)
  const large = pins.length <= 3
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${large ? 3 : 4}, minmax(0, 1fr))` }}
    >
      {pins.map((bot) => (
        <BotRow
          key={bot.name}
          bot={bot}
          pinned
          avatarSize={large ? 44 : 32}
          actions={botActions(bot)}
          onSelect={() => selectBot(bot)}
          onDropPin={(from) => orderPin(from, bot.name)}
        />
      ))}
    </div>
  )
}

function HiddenAgents({ restore }: { restore: (bot: Bot) => void }): React.JSX.Element | null {
  const t = useLanguage((s) => s.t)
  const bots = useRoster((state) => state.snapshot.bots)
  const saving = useRoster((state) => state.saving)
  const hidden = bots.filter((bot) => bot.meta.hidden)
  if (hidden.length === 0) return null
  return (
    <details className="p-2">
      <summary className="cursor-pointer text-base">
        {t('roster.hidden').replace('{count}', String(hidden.length))}
      </summary>
      {hidden.map((bot) => (
        <button
          key={bot.name}
          disabled={saving}
          onClick={() => restore(bot)}
          className="block py-2 text-base underline"
        >
          {t('roster.show').replace('{name}', botTitle(bot))}
        </button>
      ))}
    </details>
  )
}
