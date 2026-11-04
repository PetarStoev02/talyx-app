import { useState } from 'react'
import { useLanguage } from '@app/providers/useLanguage'
import { botTitle } from '@features/bots/roster'
import { useRoster } from '@features/bots/store'
import type { Bot } from '@features/bots/types'
import { Button } from '@shared/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle
} from '@shared/ui/dialog'

const dialogClass = 'border-0 bg-card shadow-none backdrop-blur-none'

// Mounted only while open, so the name resets each time and survives a failed save.
export function NewFolderDialog({
  onClose,
  onCreate
}: {
  onClose: () => void
  onCreate: (name: string) => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const saving = useRoster((state) => state.saving)
  const error = useRoster((state) => state.error)
  const [name, setName] = useState('')
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className={dialogClass}>
        <DialogTitle>{t('roster.newFolder')}</DialogTitle>
        <DialogDescription>{t('roster.newFolderHint')}</DialogDescription>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (name.trim()) onCreate(name)
          }}
          className="space-y-4"
        >
          <label className="block text-base">
            {t('roster.folderName')}
            <input
              autoFocus
              value={name}
              maxLength={100}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 block w-full rounded-lg bg-secondary px-3 py-2"
            />
          </label>
          {error && (
            <p role="alert" className="text-base">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              className="rounded-full text-base"
              type="submit"
              disabled={!name.trim() || saving}
            >
              {t('roster.createFolder')}
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
  const saving = useRoster((state) => state.saving)
  const error = useRoster((state) => state.error)
  return (
    <Dialog
      open={!!bot}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className={dialogClass}>
        <DialogTitle>
          {t('roster.deleteTitle').replace('{name}', bot ? botTitle(bot) : '')}
        </DialogTitle>
        <DialogDescription>{t('roster.deleteWarning')}</DialogDescription>
        {error && (
          <p role="alert" className="text-base">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button
            className="rounded-full text-base"
            variant="destructive"
            disabled={saving}
            onClick={() => bot && onDelete(bot)}
          >
            {t('roster.deleteProfile')}
          </Button>
          <DialogClose asChild>
            <Button className="rounded-full text-base" variant="ghost">
              {t('roster.cancel')}
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  )
}
