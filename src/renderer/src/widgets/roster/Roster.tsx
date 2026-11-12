import { useRef, useState } from 'react'
import { useLanguage } from '@app/providers/useLanguage'
import { useRosterConnection } from '@features/bots/useRosterConnection'
import type { RosterBackend } from '@features/bots/data'
import { rosterActions, runRosterMutation } from '@features/bots/actions'
import { botTitle, pinnedBots, pinnedRooms } from '@features/bots/roster'
import type { RosterProblem } from '@features/bots/roster'
import { useRoster } from '@features/bots/store'
import type { Bot, Folder, Room, RosterRowRef } from '@features/bots/types'
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
  DeleteRowsDialog,
  FolderNameDialog
} from './RosterDialogs'
import { rosterControls } from './rosterControls'
import { useCreating } from './creating'
import { Loading, Skeleton, SkeletonRows } from '@shared/ui/skeleton'
import { useFlip } from '@shared/hooks/useFlip'
import { Reveal } from '@shared/ui/Reveal'
import { useArrival } from '@shared/hooks/useStayMounted'
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
  const loading = useRoster((s) => s.loading)
  const saving = useRoster((s) => s.saving)
  const editingProfile = useRoster((s) => s.editingProfile)
  const actionError = useRoster((s) => s.actionError)
  const loadError = useRoster((s) => s.loadError)
  const pickedCount = useRoster((s) => s.picked.length)
  // Every new snapshot renders the roster, so useFlip also sees reorders from other clients.
  const { folders } = useRoster((s) => s.snapshot)
  const { select, clearError, pick } = useRoster.getState()
  const { creating, setCreating } = useCreating()
  // Pins and rows glide to their new place after a reorder, a pin or a drop.
  const pinnedArea = useRef<HTMLDivElement>(null)
  const folderArea = useRef<HTMLDivElement>(null)
  useFlip(pinnedArea)
  useFlip(folderArea)
  const arrival = useArrival(loading)
  // A dialog shows its own failure; closing it takes the failure along.
  const closing =
    (close: () => void): (() => void) =>
    () => {
      clearError()
      close()
    }
  const closeCreate = closing(() => setCreating(null))
  const [deleting, setDeleting] = useState<Bot | null>(null)
  const [deletingRoom, setDeletingRoom] = useState<Room | null>(null)
  const [renamingFolder, setRenamingFolder] = useState<Folder | null>(null)
  const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null)
  const [deletingRows, setDeletingRows] = useState<RosterRowRef[] | null>(null)
  // The folder a new folder goes into, from that folder's menu.
  const [subfolderOf, setSubfolderOf] = useState<Folder | null>(null)
  useRosterConnection(backend)
  const actions = rosterActions(backend)
  const run = (operation: () => Promise<void>): void => {
    void runRosterMutation(backend, operation)
  }
  // Every mutation re-reads the roster afterwards, so a reload is an empty mutation.
  const reload = (): void => run(() => Promise.resolve())
  // Moving on to another bot or room takes a failed action's message away.
  const selectBot = (bot: Bot): void => {
    clearError()
    select({ kind: 'bot', id: bot.name })
    onSelect()
  }
  const selectRoom = (room: Room): void => {
    clearError()
    select({ kind: 'room', id: room.room_id })
    onSelect()
  }
  const { botActions, roomActions, folderActions, drops } = rosterControls({
    actions,
    run,
    selectBot,
    setDeleting: (bot) => {
      clearError()
      setDeleting(bot)
    },
    setDeletingRoom: (room) => {
      clearError()
      setDeletingRoom(room)
    },
    setRenamingFolder: (folder) => {
      clearError()
      setRenamingFolder(folder)
    },
    setDeletingFolder: (folder) => {
      clearError()
      setDeletingFolder(folder)
    },
    setSubfolderOf: (folder) => {
      clearError()
      setSubfolderOf(folder)
    },
    setDeletingRows: (rows) => {
      clearError()
      setDeletingRows(rows)
    },
    t
  })
  const dialogOpen =
    !!deleting ||
    !!deletingRoom ||
    !!creating ||
    !!renamingFolder ||
    !!deletingFolder ||
    !!deletingRows ||
    !!subfolderOf
  return (
    <nav
      aria-label={t('roster.label')}
      aria-busy={loading || saving}
      className="flex min-h-0 flex-1 flex-col"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && useRoster.getState().picked.length) pick([], null)
      }}
    >
      <p role="status" className="sr-only">
        {pickedCount ? t('roster.picked').replace('{count}', String(pickedCount)) : ''}
      </p>
      {/* Problems and the pinned tiles stay put; only the folders scroll under them. The same
          gutter as the scrolling part keeps the tiles lined up with the rows. */}
      <div
        ref={pinnedArea}
        className="shrink-0 overflow-y-hidden px-3 pt-2 pb-3 [scrollbar-gutter:stable]"
      >
        {/* A dialog or the details panel shows a failed action itself; one place is enough. */}
        <Reveal
          value={
            // A failed read offers to read again; a failed action, which a reload would not
            // redo, to dismiss it.
            !dialogOpen && !editingProfile && actionError
              ? { problem: actionError, action: { label: t('action.dismiss'), run: clearError } }
              : loadError && {
                  problem: loadError,
                  action: { label: t('action.tryAgain'), run: reload }
                }
          }
        >
          {(banner) => <ProblemBanner {...banner} />}
        </Reveal>
        {loading && <RosterSkeleton label={t('roster.loading')} />}
        <PinnedGrid
          botActions={botActions}
          roomActions={roomActions}
          selectBot={selectBot}
          selectRoom={selectRoom}
          orderPin={(from, to) => run(() => actions.orderPin(from, to))}
        />
      </div>
      {/* The arrival runs on an inner box: the list's own animations drive its edge fades. */}
      <div ref={folderArea} className="scroll-y-stable scroll-fade min-h-0 flex-1 px-3 pb-3">
        <div className={arrival}>
          {/* Until the first read, the skeleton above stands in for the folders too. */}
          {!loading &&
            [...folders.filter((folder) => !folder.parentId), null].map((folder) => (
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
          onClose={closing(() => setSubfolderOf(null))}
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
          onClose={closing(() => setRenamingFolder(null))}
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
        onClose={closing(() => setDeletingFolder(null))}
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
        onClose={closing(() => setDeletingRoom(null))}
        onDelete={(room) =>
          run(async () => {
            await actions.deleteRoom(room)
            // The room is gone; a failed layout cleanup shows on the roster, not in this dialog.
            setDeletingRoom(null)
            await actions.forgetRoom(room)
          })
        }
      />
      <DeleteRowsDialog
        rows={deletingRows}
        onClose={closing(() => setDeletingRows(null))}
        onDelete={(rows) =>
          run(async () => {
            await actions.deleteRows(rows)
            setDeletingRows(null)
            pick([], null)
          })
        }
      />
      <DeleteProfileDialog
        bot={deleting}
        onClose={closing(() => setDeleting(null))}
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

// Given the problem by its Reveal, so it keeps its words while it closes.
function ProblemBanner({
  problem,
  action
}: {
  problem: RosterProblem
  action: { label: string; run: () => void }
}): React.JSX.Element {
  return (
    <div className="mb-2 rounded-xl bg-secondary p-3 text-base">
      <ProblemMessage problem={problem} />
      <button className="mt-2 underline underline-offset-4 hover:decoration-2" onClick={action.run}>
        {action.label}
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
        <div key={bot.name} data-flip={`bot:${bot.name}`}>
          <BotRow
            bot={bot}
            pinned
            avatarSize={large ? 44 : 32}
            actions={() => botActions(bot)}
            onSelect={() => selectBot(bot)}
            onDropPin={(from) => orderPin(from, bot.name)}
          />
        </div>
      ))}
      {rooms.map((room) => (
        <div key={room.room_id} data-flip={`room:${room.room_id}`}>
          <RoomRow
            room={room}
            pinned
            avatarSize={large ? 44 : 32}
            actions={() => roomActions(room)}
            onSelect={() => selectRoom(room)}
          />
        </div>
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

// The roster on its way: two pinned tiles and a folder of rows.
function RosterSkeleton({ label }: { label: string }): React.JSX.Element {
  return (
    <Loading label={label}>
      <div className="flex justify-center gap-2">
        <Skeleton className="h-36 w-[calc((100%-1rem)/3)] rounded-xl" />
        <Skeleton className="h-36 w-[calc((100%-1rem)/3)] rounded-xl" />
      </div>
      <Skeleton className="mt-5 ml-2 h-3.5 w-24" />
      <div className="mt-2 pl-6">
        <SkeletonRows count={4} />
      </div>
    </Loading>
  )
}
