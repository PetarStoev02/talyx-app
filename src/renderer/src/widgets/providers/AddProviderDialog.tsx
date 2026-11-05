import { useState } from 'react'
import { toast } from 'sonner'
import { useLanguage } from '@app/providers/useLanguage'
import {
  checkEndpoint,
  checkKey,
  keyMustBeRetyped,
  saveEndpoint,
  saveKey
} from '@features/providers/providers'
import type {
  CustomEndpoint,
  ProvidersBackend,
  ProvidersOverview
} from '@features/providers/providers'
import { cn } from '@shared/lib/utils'
import type { TranslationKey } from '@shared/lib/i18n'
import { Button } from '@shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@shared/ui/dialog'
import { failureText, reportSpread } from './feedback'
import { SignIn } from './SignIn'
import { Input, NativeSelect, Textarea } from '@shared/ui/input'

const linkClass = 'text-base underline underline-offset-4 disabled:opacity-50'
type Kind = 'key' | 'account' | 'endpoint'
const KINDS: Array<[Kind, TranslationKey]> = [
  ['key', 'providers.kindKey'],
  ['account', 'providers.kindAccount'],
  ['endpoint', 'providers.kindEndpoint']
]

interface FormProps {
  backend: ProvidersBackend
  overview: ProvidersOverview
  onChanged: () => Promise<void>
  onClose: () => void
}

// Mounted only while open, so each form starts from the saved state.
export function AddProviderDialog({
  editing,
  ...form
}: FormProps & { editing: CustomEndpoint | null }): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [kind, setKind] = useState<Kind>('key')
  return (
    <Dialog open onOpenChange={(open) => !open && form.onClose()}>
      <DialogContent>
        <DialogTitle>
          {editing
            ? t('providers.editTitle').replace('{name}', editing.name)
            : t('providers.addTitle')}
        </DialogTitle>
        <DialogDescription>{t('providers.hint')}</DialogDescription>
        {!editing && (
          <div role="group" aria-label={t('providers.kinds')} className="flex gap-2">
            {KINDS.map(([value, label]) => (
              <button
                key={value}
                aria-pressed={kind === value}
                onClick={() => setKind(value)}
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                  kind === value
                    ? 'bg-foreground text-background'
                    : 'bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                {t(label)}
              </button>
            ))}
          </div>
        )}
        {editing || kind === 'endpoint' ? (
          <EndpointForm {...form} editing={editing} />
        ) : kind === 'key' ? (
          <KeyForm {...form} />
        ) : (
          <AccountForm {...form} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function KeyForm({ backend, overview, onChanged, onClose }: FormProps): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const slots = [...overview.keys].sort((a, b) => a.provider.localeCompare(b.provider))
  const [provider, setProvider] = useState(slots[0]?.provider ?? '')
  const [value, setValue] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState<'check' | 'save' | null>(null)
  const slot = slots.find((item) => item.provider === provider)

  async function check(): Promise<void> {
    if (!slot) return
    setBusy('check')
    try {
      const result = await checkKey(backend, { key: slot.key, value })
      setNote(
        result.verdict === 'works'
          ? t('providers.checkOk')
          : result.verdict === 'unchecked'
            ? t('providers.checkUnreachable')
            : result.message
      )
    } catch (error) {
      setNote(failureText(t, error))
    } finally {
      setBusy(null)
    }
  }

  async function save(): Promise<void> {
    if (!slot) return
    setBusy('save')
    try {
      reportSpread(t, await saveKey(backend, { key: slot.key, value }), 'providers.saved')
      await onChanged()
      onClose()
    } catch (error) {
      setNote(failureText(t, error))
      setBusy(null)
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (!busy) void save()
      }}
    >
      <label className="block text-base">
        {t('providers.provider')}
        <NativeSelect
          value={provider}
          onChange={(event) => {
            setProvider(event.target.value)
            setNote(null)
          }}
        >
          {slots.map((item) => (
            <option key={item.provider} value={item.provider}>
              {item.provider}
            </option>
          ))}
        </NativeSelect>
      </label>
      <label className="block text-base">
        {t('providers.apiKey')}
        <Input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        {slot?.docsUrl && (
          <a
            href={slot.docsUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-sm underline underline-offset-4"
          >
            {t('providers.docs')}
          </a>
        )}
      </label>
      <Note text={note} />
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={!!busy || !value.trim()}>
          {busy === 'save' ? t('providers.saving') : t('providers.save')}
        </Button>
        <button
          type="button"
          className={linkClass}
          disabled={!!busy || !value.trim()}
          onClick={() => void check()}
        >
          {busy === 'check' ? t('providers.checking') : t('providers.check')}
        </button>
      </div>
    </form>
  )
}

function AccountForm({ backend, overview, onChanged, onClose }: FormProps): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [picked, setPicked] = useState<string | null>(null)
  const open = overview.accounts.filter((account) => !account.signedIn)
  const account = open.find((item) => item.id === picked)
  if (account)
    return (
      <SignIn
        backend={backend}
        account={account}
        onBack={() => setPicked(null)}
        onDone={async () => {
          toast.success(t('providers.signInDone').replace('{name}', account.name))
          await onChanged()
          onClose()
        }}
      />
    )
  if (open.length === 0) return <p className="text-base">{t('providers.accountsAll')}</p>
  return (
    <ul className="space-y-2">
      {open.map((item) => (
        <li key={item.id}>
          <button
            onClick={() => setPicked(item.id)}
            className="flex w-full items-center justify-between rounded-xl bg-secondary p-3 text-left text-base hover:bg-accent"
          >
            <span>{item.name}</span>
            <span className="text-sm text-muted-foreground">{t('providers.signIn')}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function EndpointForm({
  backend,
  editing,
  onChanged,
  onClose
}: FormProps & { editing: CustomEndpoint | null }): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [name, setName] = useState(editing?.name ?? '')
  const [baseUrl, setBaseUrl] = useState(editing?.base_url ?? '')
  const [apiKey, setApiKey] = useState('')
  // An edit can only add models (the engine never drops one), so the field holds the new ones.
  const [models, setModels] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState<'check' | 'save' | null>(null)
  const typed = models.split(/[\n,]/)
  const draft = { editing, name, baseUrl, apiKey, models: [...(editing?.models ?? []), ...typed] }
  const keyNeeded = keyMustBeRetyped(editing)

  async function check(): Promise<void> {
    setBusy('check')
    try {
      const result = await checkEndpoint(backend, draft)
      setNote(
        result.ok
          ? t('providers.checkModels').replace('{count}', String(result.models.length))
          : result.message
      )
      if (result.ok && !editing && !models.trim() && result.models[0]) setModels(result.models[0])
    } catch (error) {
      setNote(failureText(t, error))
    } finally {
      setBusy(null)
    }
  }

  async function save(): Promise<void> {
    setBusy('save')
    try {
      reportSpread(t, await saveEndpoint(backend, draft), 'providers.saved')
      await onChanged()
      onClose()
    } catch (error) {
      setNote(failureText(t, error))
      setBusy(null)
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (!busy) void save()
      }}
    >
      {!editing && <p className="text-base">{t('providers.endpointHint')}</p>}
      <label className="block text-base">
        {t('providers.name')}
        <Input value={name} maxLength={100} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="block text-base">
        {t('providers.baseUrl')}
        <Input
          type="url"
          value={baseUrl}
          placeholder="http://127.0.0.1:8000/v1"
          spellCheck={false}
          onChange={(event) => setBaseUrl(event.target.value)}
        />
      </label>
      <label className="block text-base">
        {t('providers.apiKey')}
        <Input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
        />
        {(keyNeeded || editing?.has_api_key) && (
          <span className="mt-1 block text-sm text-muted-foreground">
            {t(keyNeeded ? 'providers.apiKeyRetype' : 'providers.apiKeyKeep')}
          </span>
        )}
      </label>
      <label className="block text-base">
        {t(editing ? 'providers.endpointModelsAdd' : 'providers.endpointModels')}
        <Textarea
          value={models}
          rows={3}
          spellCheck={false}
          onChange={(event) => setModels(event.target.value)}
        />
        <span className="mt-1 block text-sm text-muted-foreground">
          {editing
            ? t('providers.endpointModelsSaved').replace('{models}', editing.models.join(', '))
            : t('providers.endpointModelsHint')}
        </span>
      </label>
      <Note text={note} />
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={!!busy || (keyNeeded && !apiKey.trim())}>
          {busy === 'save' ? t('providers.saving') : t('providers.save')}
        </Button>
        <button
          type="button"
          className={linkClass}
          disabled={!!busy || !baseUrl.trim()}
          onClick={() => void check()}
        >
          {busy === 'check' ? t('providers.checking') : t('providers.check')}
        </button>
      </div>
    </form>
  )
}

function Note({ text }: { text: string | null }): React.JSX.Element | null {
  return text ? (
    <p role="status" className="text-base">
      {text}
    </p>
  ) : null
}
