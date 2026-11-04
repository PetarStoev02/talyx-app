import { useEffect, useState } from 'react'
import { useLanguage } from '@app/providers/useLanguage'
import { rosterActions, runRosterMutation } from '@features/bots/actions'
import type { RosterBackend } from '@features/bots/data'
import { ProblemMessage } from '@features/bots/ProblemMessage'
import {
  MAX_ROOM_MEMBERS,
  MIN_ROOM_MEMBERS,
  createRoom,
  seatableProfiles
} from '@features/bots/rooms'
import { botTitle, folderPath, problemOf } from '@features/bots/roster'
import { useRoster } from '@features/bots/store'
import { Button } from '@shared/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle
} from '@shared/ui/dialog'

const fieldClass = 'mt-2 block w-full rounded-lg bg-secondary px-3 py-2 text-base'

// Mounted only while open, so the form starts empty each time and survives a failed create.
export function CreateRoomDialog({
  backend,
  onClose
}: {
  backend: RosterBackend
  onClose: () => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const { snapshot, selection, saving, error } = useRoster()
  const selected = snapshot.bots.find(
    (bot) => selection?.kind === 'bot' && bot.name === selection.id
  )
  const [name, setName] = useState('')
  const [folderId, setFolderId] = useState(
    snapshot.folders.some((folder) => folder.id === selected?.meta.sectionId)
      ? (selected?.meta.sectionId ?? '')
      : ''
  )
  const [picked, setPicked] = useState<string[]>([])
  // The bots the engine will seat; null when it does not say, and create checks instead.
  const [seatable, setSeatable] = useState<{ profiles: string[] | null } | null>(null)

  useEffect(() => {
    let live = true
    seatableProfiles(backend)
      .then((profiles) => live && setSeatable({ profiles }))
      .catch((failure: unknown) => {
        if (!live) return
        setSeatable({ profiles: [] })
        useRoster.setState({ error: problemOf(failure) })
      })
    return () => {
      live = false
    }
  }, [backend])

  const candidates = snapshot.bots.filter(
    (bot) => !bot.meta.hidden && (seatable?.profiles?.includes(bot.name) ?? true)
  )
  const ready =
    !!name.trim() && picked.length >= MIN_ROOM_MEMBERS && picked.length <= MAX_ROOM_MEMBERS

  function toggle(profile: string): void {
    setPicked((current) =>
      current.includes(profile) ? current.filter((item) => item !== profile) : [...current, profile]
    )
  }

  function create(): void {
    const members = snapshot.bots.filter((bot) => picked.includes(bot.name))
    void runRosterMutation(backend, async () => {
      const roomId = await createRoom(backend, { name, members })
      useRoster.getState().select({ kind: 'room', id: roomId })
      onClose()
      // The room exists from here on; a failed filing shows on the roster, not in a dialog.
      if (folderId) await rosterActions(backend).moveRoom(roomId, folderId)
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-0 bg-card shadow-none backdrop-blur-none">
        <DialogTitle>{t('rooms.createTitle')}</DialogTitle>
        <DialogDescription>{t('rooms.createHint')}</DialogDescription>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (ready && !saving) create()
          }}
        >
          <label className="block text-base">
            {t('rooms.name')}
            <input
              autoFocus
              value={name}
              maxLength={100}
              onChange={(event) => setName(event.target.value)}
              className={fieldClass}
            />
          </label>
          <fieldset className="text-base">
            <legend className="flex w-full justify-between">
              {t('rooms.members')}
              <span className="text-sm text-muted-foreground">
                {t('rooms.membersPicked').replace('{count}', String(picked.length))}
              </span>
            </legend>
            {seatable === null ? (
              <p className="mt-2" role="status">
                {t('rooms.membersLoading')}
              </p>
            ) : (
              <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-lg bg-secondary p-2">
                {candidates.map((bot) => {
                  const checked = picked.includes(bot.name)
                  return (
                    <li key={bot.name}>
                      <label className="flex items-center gap-3 rounded-md px-2 py-1 hover:bg-accent">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!checked && picked.length >= MAX_ROOM_MEMBERS}
                          onChange={() => toggle(bot.name)}
                        />
                        {botTitle(bot)}
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          </fieldset>
          <label className="block text-base">
            {t('create.folder')}
            <select
              value={folderId}
              onChange={(event) => setFolderId(event.target.value)}
              className={fieldClass}
            >
              <option value="">{t('roster.unassigned')}</option>
              {snapshot.folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folderPath(snapshot.folders, folder)}
                </option>
              ))}
            </select>
          </label>
          {error && (
            <div role="alert">
              <ProblemMessage problem={error} />
            </div>
          )}
          <div className="flex gap-2">
            <Button className="rounded-full text-base" type="submit" disabled={!ready || saving}>
              {t('rooms.create')}
            </Button>
            <DialogClose asChild>
              <Button className="rounded-full text-base" type="button" variant="ghost">
                {t('roster.cancel')}
              </Button>
            </DialogClose>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
