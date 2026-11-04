import { useState } from 'react'
import { useLanguage } from '@app/providers/useLanguage'
import { runRosterMutation } from '@features/bots/actions'
import { UnfiledBotError, createBot, profileIdFor } from '@features/bots/create'
import type { RosterBackend } from '@features/bots/data'
import type { ModelChoice } from '@features/bots/details'
import { ProblemMessage } from '@features/bots/ProblemMessage'
import { problemOf } from '@features/bots/roster'
import { useRoster } from '@features/bots/store'
import type { Folder } from '@features/bots/types'
import type { ModelOptionProvider } from '@shared/engine/gateway-events'
import { Button } from '@shared/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle
} from '@shared/ui/dialog'
import { ModelField } from '@shared/ui/ModelPicker'

const fieldClass = 'mt-2 block w-full rounded-lg bg-secondary px-3 py-2 text-base'

// Mounted only while open, so the form starts empty each time and survives a failed create.
export function CreateBotDialog({
  backend,
  models,
  onClose
}: {
  backend: RosterBackend
  models: ((profile: string) => Promise<ModelOptionProvider[]>) | null
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
  const [model, setModel] = useState<ModelChoice | null>(null)
  const taken = snapshot.bots.map((bot) => bot.name)
  const id = idPreview(name, taken)

  function create(): void {
    const folder = snapshot.folders.find((item) => item.id === folderId) ?? null
    void runRosterMutation(backend, async () => {
      try {
        const created = await createBot(backend, { name, folder, model }, taken)
        useRoster.getState().select({ kind: 'bot', id: created })
        onClose()
      } catch (error) {
        // The bot exists: show it rather than let a retry create a second one.
        if (!(error instanceof UnfiledBotError)) throw error
        useRoster.getState().select({ kind: 'bot', id: error.profile })
        onClose()
        throw error
      }
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-0 bg-card shadow-none backdrop-blur-none">
        <DialogTitle>{t('create.title')}</DialogTitle>
        <DialogDescription>{t('create.hint')}</DialogDescription>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (id.ok && !saving) create()
          }}
        >
          <label className="block text-base">
            {t('create.name')}
            <input
              autoFocus
              value={name}
              maxLength={100}
              aria-describedby="create-profile-id"
              onChange={(event) => setName(event.target.value)}
              className={fieldClass}
            />
            <span id="create-profile-id" className="mt-1 block text-sm text-muted-foreground">
              {id.text && (id.ok ? t('create.profileId').replace('{id}', id.text) : t(id.text))}
            </span>
          </label>
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
          <div className="text-base">
            {t('details.model')}
            <ModelField
              labels={{
                field: t('details.model'),
                empty: t('details.modelDefault'),
                loading: t('chat.modelsLoading')
              }}
              value={model}
              load={models && (() => models('default'))}
              onSelect={setModel}
            />
          </div>
          <div className="text-base">
            {t('create.look')}
            <p className="mt-2 rounded-lg bg-secondary px-3 py-2">{t('create.lookMatch')}</p>
          </div>
          {error && (
            <div role="alert">
              <ProblemMessage problem={error} />
            </div>
          )}
          <div className="flex gap-2">
            <Button className="rounded-full text-base" type="submit" disabled={!id.ok || saving}>
              {t('create.submit')}
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

// The profile id the name will get, or why it cannot be used.
function idPreview(
  name: string,
  taken: string[]
): { ok: true; text: string } | { ok: false; text: ReturnType<typeof problemOf>['key'] | '' } {
  if (!name.trim()) return { ok: false, text: '' }
  try {
    return { ok: true, text: profileIdFor(name, taken) }
  } catch (error) {
    return { ok: false, text: problemOf(error).key }
  }
}

function folderPath(folders: Folder[], folder: Folder): string {
  const parent = folders.find((item) => item.id === folder.parentId)
  return parent ? `${folderPath(folders, parent)} / ${folder.name}` : folder.name
}
