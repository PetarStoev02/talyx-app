import { useState } from 'react'
import { useLanguage } from '@app/providers/useLanguage'
import type { ModelOptionProvider } from '@shared/engine/gateway-events'
import { Button } from '@shared/ui/button'
import { Input, NativeSelect } from '@shared/ui/input'
import { ModelField } from '@shared/ui/ModelPicker'
import { runRosterMutation } from './actions'
import { IncompleteBotError, createBot, profileIdFor } from './create'
import type { RosterBackend } from './data'
import type { ModelChoice } from './details'
import { matchName } from './look'
import type { Look } from './look'
import { LookPicker } from './LookPicker'
import { ProblemMessage } from './ProblemMessage'
import { folderPath, problemOf } from './roster'
import { useRoster } from './store'

/**
 * The create-bot form with its own submit button; `secondary` sits beside it (Cancel in the
 * dialog). `onCreated` also fires when a later step failed, as the bot then exists.
 */
export function CreateBotForm({
  backend,
  models,
  initialFolderId,
  onCreated,
  submitLabel,
  secondary
}: {
  backend: RosterBackend
  models: ((profile: string) => Promise<ModelOptionProvider[]>) | null
  /** The folder a new bot goes in; null falls back to the open bot's folder, else Unassigned. */
  initialFolderId: string | null
  onCreated: (profile: string) => void
  submitLabel: string
  secondary: React.ReactNode
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const snapshot = useRoster((s) => s.snapshot)
  const selection = useRoster((s) => s.selection)
  const saving = useRoster((s) => s.saving)
  const error = useRoster((s) => s.actionError)
  const selected = snapshot.bots.find(
    (bot) => selection?.kind === 'bot' && bot.name === selection.id
  )
  const [name, setName] = useState('')
  const [folderId, setFolderId] = useState(
    initialFolderId ??
      (snapshot.folders.some((folder) => folder.id === selected?.meta.sectionId)
        ? (selected?.meta.sectionId ?? '')
        : '')
  )
  const [model, setModel] = useState<ModelChoice | null>(null)
  const [purpose, setPurpose] = useState('')
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
        onCreated(await createBot(backend, { name, folder, model, look, purpose }, taken))
      } catch (error) {
        // The bot exists: show it rather than let a retry create a second one.
        if (!(error instanceof IncompleteBotError)) throw error
        onCreated(error.profile)
        throw error
      }
    })
  }

  return (
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
        {t('create.purpose')}
        <Input
          value={purpose}
          placeholder={t('create.purposeHint')}
          onChange={(event) => setPurpose(event.target.value)}
        />
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
            loading: t('chat.modelsLoading'),
            failed: t('chat.modelsFailed')
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
      {error && <ProblemMessage problem={error} />}
      <div className="flex gap-2">
        <Button type="submit" disabled={!id.ok || saving}>
          {submitLabel}
        </Button>
        {secondary}
      </div>
    </form>
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
