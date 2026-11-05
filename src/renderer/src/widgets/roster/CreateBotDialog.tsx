import { useState } from 'react'
import { useLanguage } from '@app/providers/useLanguage'
import { runRosterMutation } from '@features/bots/actions'
import { IncompleteBotError, createBot, profileIdFor } from '@features/bots/create'
import type { RosterBackend } from '@features/bots/data'
import type { ModelChoice } from '@features/bots/details'
import { matchName } from '@features/bots/look'
import type { Look } from '@features/bots/look'
import { LookPicker } from '@features/bots/LookPicker'
import { ProblemMessage } from '@features/bots/ProblemMessage'
import { folderPath, problemOf } from '@features/bots/roster'
import { useRoster } from '@features/bots/store'
import type { ModelOptionProvider } from '@shared/engine/gateway-events'
import { Button } from '@shared/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle
} from '@shared/ui/dialog'
import { Input, NativeSelect } from '@shared/ui/input'
import { ModelField } from '@shared/ui/ModelPicker'

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
  const profile = id.ok ? id.text : ''
  const named = matchName(profile)
  // Until a shape or hue is picked, the look follows the name as it is typed.
  const [picked, setPicked] = useState<Partial<Look>>({})
  const look: Look = { ...named, faces: true, ...picked }
  const pick = (next: Look): void =>
    setPicked(next.shape === named.shape && next.hue === named.hue ? { faces: next.faces } : next)

  function create(): void {
    const folder = snapshot.folders.find((item) => item.id === folderId) ?? null
    void runRosterMutation(backend, async () => {
      try {
        const created = await createBot(backend, { name, folder, model, look }, taken)
        useRoster.getState().select({ kind: 'bot', id: created })
        onClose()
      } catch (error) {
        // The bot exists: show it rather than let a retry create a second one.
        if (!(error instanceof IncompleteBotError)) throw error
        useRoster.getState().select({ kind: 'bot', id: error.profile })
        onClose()
        throw error
      }
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
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
            <Input
              autoFocus
              value={name}
              maxLength={100}
              aria-describedby="create-profile-id"
              onChange={(event) => setName(event.target.value)}
            />
            <span id="create-profile-id" className="mt-1 block text-sm text-muted-foreground">
              {id.text && (id.ok ? t('create.profileId').replace('{id}', id.text) : t(id.text))}
            </span>
          </label>
          <label className="block text-base">
            {t('create.folder')}
            <NativeSelect value={folderId} onChange={(event) => setFolderId(event.target.value)}>
              <option value="">{t('roster.unassigned')}</option>
              {snapshot.folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folderPath(snapshot.folders, folder)}
                </option>
              ))}
            </NativeSelect>
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
            <div className="mt-2">
              <LookPicker look={look} profile={profile} onChange={pick} />
            </div>
          </div>
          {error && (
            <div role="alert">
              <ProblemMessage problem={error} />
            </div>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={!id.ok || saving}>
              {t('create.submit')}
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
