import { useState } from 'react'
import { useLanguage } from '@app/providers/useLanguage'
import { useRosterConnection } from '@features/bots/useRosterConnection'
import type { RosterBackend } from '@features/bots/data'
import { rosterActions, runRosterMutation } from '@features/bots/actions'
import { botTitle, pinnedBots, pinnedRooms } from '@features/bots/roster'
import { useRoster } from '@features/bots/store'
import type { Bot, Folder, Room } from '@features/bots/types'
import { BotRow } from './BotRow'
import { FolderGroup } from './FolderGroup'
import { RoomRow } from './RoomRow'
import { ProblemMessage } from '@features/bots/ProblemMessage'
import type { ModelOptionProvider } from '@shared/engine/gateway-events'
import { CreateBotDialog } from './CreateBotDialog'
import { CreateRoomDialog } from './CreateRoomDialog'
import {
  DeleteFolderDialog,
  DeleteProfileDialog,
  DeleteRoomDialog,
  FolderNameDialog
} from './RosterDialogs'
import { rosterControls } from './rosterControls'
import { useCreating } from './creating'
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
  const { creating, setCreating } = useCreating()
  const closeCreate = (): void => setCreating(null)
  const [deleting, setDeleting] = useState<Bot | null>(null)
  const [deletingRoom, setDeletingRoom] = useState<Room | null>(null)
  const [renamingFolder, setRenamingFolder] = useState<Folder | null>(null)
  const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null)
  // The folder a new folder goes into, from that folder's menu.
  const [subfolderOf, setSubfolderOf] = useState<Folder | null>(null)
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
  const { botActions, roomActions, folderActions, drops } = rosterControls({
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
    setRenamingFolder: (folder) => {
      state.clearError()
      setRenamingFolder(folder)
    },
    setDeletingFolder: (folder) => {
      state.clearError()
      setDeletingFolder(folder)
    },
    setSubfolderOf: (folder) => {
      state.clearError()
      setSubfolderOf(folder)
    },
    t
  })
  const dialogOpen =
    !!deleting ||
    !!deletingRoom ||
    !!creating ||
    !!renamingFolder ||
    !!deletingFolder ||
    !!subfolderOf
  return (
    <nav
      aria-label={t('roster.label')}
      aria-busy={state.loading || state.saving}
      className="flex min-h-0 flex-1 flex-col"
    >
      {/* Problems and the pinned tiles stay put; only the folders scroll under them. The same
          gutter as the scrolling part keeps the tiles lined up with the rows. */}
      <div className="shrink-0 overflow-y-hidden px-3 pt-2 pb-3 [scrollbar-gutter:stable]">
        {!dialogOpen && <ProblemBanner retry={reload} />}
        {state.loading && (
          <p role="status" className="p-2">
            {t('roster.loading')}
          </p>
        )}
        <PinnedGrid
          botActions={botActions}
          roomActions={roomActions}
          selectBot={selectBot}
          selectRoom={selectRoom}
          orderPin={(from, to) => run(() => actions.orderPin(from, to))}
        />
      </div>
      <div className="scroll-y-stable min-h-0 flex-1 px-3 pb-3">
        {[...state.snapshot.folders.filter((folder) => !folder.parentId), null].map((folder) => (
          <FolderGroup
            key={folder?.id ?? 'unassigned'}
            folder={folder}
            botActions={botActions}
            folderActions={folderActions}
            selectBot={selectBot}
            selectRoom={selectRoom}
            drops={drops}
            roomActions={roomActions}
          />
        ))}
        <HiddenAgents restore={(bot) => run(() => actions.hide(bot))} />
      </div>
      {creating === 'folder' && (
        <FolderNameDialog
          copy={{
            title: t('roster.newFolder'),
            hint: t('roster.newFolderHint'),
            submit: t('roster.createFolder')
          }}
          onClose={closeCreate}
          onSubmit={(name) =>
            run(async () => {
              await actions.addFolder(name, null)
              closeCreate()
            })
          }
        />
      )}
      {subfolderOf && (
        <FolderNameDialog
          copy={{
            title: t('roster.newFolderIn').replace('{name}', subfolderOf.name),
            hint: t('roster.newFolderHint'),
            submit: t('roster.createFolder')
          }}
          onClose={() => setSubfolderOf(null)}
          onSubmit={(name) =>
            run(async () => {
              await actions.addFolder(name, subfolderOf.id)
              setSubfolderOf(null)
            })
          }
        />
      )}
      {renamingFolder && (
        <FolderNameDialog
          copy={{
            title: t('roster.renameFolder'),
            hint: t('roster.renameFolderHint'),
            submit: t('roster.renameFolder')
          }}
          initialName={renamingFolder.name}
          onClose={() => setRenamingFolder(null)}
          onSubmit={(name) =>
            run(async () => {
              await actions.renameFolder(renamingFolder.id, name)
              setRenamingFolder(null)
            })
          }
        />
      )}
      <DeleteFolderDialog
        folder={deletingFolder}
        onClose={() => setDeletingFolder(null)}
        onDelete={(folder) =>
          run(async () => {
            await actions.deleteFolder(folder.id)
            setDeletingFolder(null)
          })
        }
      />
      {creating === 'bot' && (
        <CreateBotDialog backend={backend} models={models} onClose={closeCreate} />
      )}
      {creating === 'room' && <CreateRoomDialog backend={backend} onClose={closeCreate} />}
      <DeleteRoomDialog
        room={deletingRoom}
        onClose={() => setDeletingRoom(null)}
        onDelete={(room) =>
          run(async () => {
            await actions.deleteRoom(room)
            // The room is gone; a failed layout cleanup shows on the roster, not in this dialog.
            setDeletingRoom(null)
            await actions.forgetRoom(room)
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
      <button className="mt-2 underline underline-offset-4 hover:decoration-2" onClick={retry}>
        {t('action.tryAgain')}
      </button>
    </div>
  )
}

// Up to three pins show as large tiles; a fourth switches to four small ones a row. Pinned bots
// come first, then pinned rooms; a row that is not full is centered.
function PinnedGrid({
  botActions,
  roomActions,
  selectBot,
  selectRoom,
  orderPin
}: {
  botActions: (bot: Bot) => MenuAction[]
  roomActions: (room: Room) => MenuAction[]
  selectBot: (bot: Bot) => void
  selectRoom: (room: Room) => void
  orderPin: (from: string, to: string) => void
}): React.JSX.Element {
  const snapshot = useRoster((state) => state.snapshot)
  const pins = pinnedBots(snapshot.bots)
  const rooms = pinnedRooms(snapshot)
  const large = pins.length + rooms.length <= 3
  // A full row of 3 or 4 tiles with the gap-2 (0.5rem) between them; change both together.
  const tile = large ? 'calc((100% - 1rem) / 3)' : 'calc((100% - 1.5rem) / 4)'
  return (
    <div
      className="flex flex-wrap justify-center gap-2 [&>*]:w-(--tile)"
      style={{ '--tile': tile } as React.CSSProperties}
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
      {rooms.map((room) => (
        <RoomRow
          key={room.room_id}
          room={room}
          pinned
          avatarSize={large ? 44 : 32}
          actions={roomActions(room)}
          onSelect={() => selectRoom(room)}
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
          className="block py-2 text-base underline underline-offset-4 hover:decoration-2"
        >
          {t('roster.show').replace('{name}', botTitle(bot))}
        </button>
      ))}
    </details>
  )
}
