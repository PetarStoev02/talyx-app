import { useState } from 'react'
import { useLanguage } from '@app/providers/useLanguage'
import { botTitle } from '@features/bots/roster'
import { useRoster } from '@features/bots/store'
import type { Bot, Folder, Room } from '@features/bots/types'
import { ProblemMessage } from '@features/bots/ProblemMessage'
import { Button } from '@shared/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle
} from '@shared/ui/dialog'
import { Input } from '@shared/ui/input'

/** The words of a folder-name dialog: New folder and Rename folder share the form. */
export interface FolderNameCopy {
  title: string
  hint: string
  submit: string
}

// Mounted only while open, so the name resets each time and survives a failed save.
export function FolderNameDialog({
  copy,
  initialName = '',
  onClose,
  onSubmit
}: {
  copy: FolderNameCopy
  initialName?: string
  onClose: () => void
  onSubmit: (name: string) => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const saving = useRoster((state) => state.saving)
  const error = useRoster((state) => state.actionError)
  const [name, setName] = useState(initialName)
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent>
        <DialogTitle>{copy.title}</DialogTitle>
        <DialogDescription>{copy.hint}</DialogDescription>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (name.trim()) onSubmit(name)
          }}
          className="space-y-4"
        >
          <label className="block text-base">
            {t('roster.folderName')}
            <Input
              autoFocus
              value={name}
              maxLength={100}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          {error && (
            <div role="alert">
              <ProblemMessage problem={error} />
            </div>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={!name.trim() || saving}>
              {copy.submit}
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                {t('roster.cancel')}
              </Button>
            </DialogClose>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteProfileDialog({
  bot,
  onClose,
  onDelete
}: {
  bot: Bot | null
  onClose: () => void
  onDelete: (bot: Bot) => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  return (
    <ConfirmDeleteDialog
      open={!!bot}
      title={t('roster.deleteTitle').replace('{name}', bot ? botTitle(bot) : '')}
      warning={t('roster.deleteWarning')}
      confirm={t('roster.deleteProfile')}
      onClose={onClose}
      onConfirm={() => bot && onDelete(bot)}
    />
  )
}

export function DeleteFolderDialog({
  folder,
  onClose,
  onDelete
}: {
  folder: Folder | null
  onClose: () => void
  onDelete: (folder: Folder) => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  return (
    <ConfirmDeleteDialog
      open={!!folder}
      title={t('roster.deleteTitle').replace('{name}', folder?.name ?? '')}
      warning={t(folder?.parentId ? 'roster.deleteFolderWarning' : 'roster.deleteTopFolderWarning')}
      confirm={t('roster.deleteFolder')}
      onClose={onClose}
      onConfirm={() => folder && onDelete(folder)}
    />
  )
}

export function DeleteRoomDialog({
  room,
  onClose,
  onDelete
}: {
  room: Room | null
  onClose: () => void
  onDelete: (room: Room) => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  return (
    <ConfirmDeleteDialog
      open={!!room}
      title={t('roster.deleteTitle').replace('{name}', room?.name ?? '')}
      warning={t('roster.deleteRoomWarning')}
      confirm={t('roster.deleteRoom')}
      onClose={onClose}
      onConfirm={() => room && onDelete(room)}
    />
  )
}

function ConfirmDeleteDialog({
  open,
  title,
  warning,
  confirm,
  onClose,
  onConfirm
}: {
  open: boolean
  title: string
  warning: string
  confirm: string
  onClose: () => void
  onConfirm: () => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const saving = useRoster((state) => state.saving)
  const error = useRoster((state) => state.actionError)
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{warning}</DialogDescription>
        {error && (
          <div role="alert">
            <ProblemMessage problem={error} />
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="destructive" disabled={saving} onClick={onConfirm}>
            {confirm}
          </Button>
          <DialogClose asChild>
            <Button variant="ghost">{t('roster.cancel')}</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  )
}
