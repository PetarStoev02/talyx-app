import { useState } from 'react'
import { useLanguage } from '@app/providers/useLanguage'
import { testChat } from '@features/providers/providers'
import type {
  CustomEndpoint,
  ProvidersBackend,
  TestChatOutcome
} from '@features/providers/providers'
import { Button } from '@shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@shared/ui/dialog'
import { NativeSelect } from '@shared/ui/input'
import { failureText } from './feedback'

/** Sends one real message on one of the endpoint's models and shows what came back. */
export function TestChatDialog({
  backend,
  endpoint,
  onClose
}: {
  backend: ProvidersBackend
  endpoint: CustomEndpoint
  onClose: () => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [model, setModel] = useState(endpoint.models[0] ?? endpoint.model)
  const [result, setResult] = useState<TestChatOutcome | null>(null)
  const [busy, setBusy] = useState(false)

  async function send(): Promise<void> {
    setBusy(true)
    setResult(null)
    try {
      setResult(await testChat(backend, { provider: endpoint.id, model }))
    } catch (error) {
      setResult({ ok: false, cause: error, closed: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent>
        <DialogTitle>{t('providers.testChatTitle').replace('{name}', endpoint.name)}</DialogTitle>
        <DialogDescription>{t('providers.testChatHint')}</DialogDescription>
        {endpoint.models.length > 1 && (
          <label className="block text-base">
            {t('providers.testChatModel')}
            <NativeSelect
              value={model}
              disabled={busy}
              onChange={(event) => {
                setModel(event.target.value)
                setResult(null)
              }}
            >
              {endpoint.models.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </NativeSelect>
          </label>
        )}
        {/* Always in the page, so a screen reader announces the result when it is filled in. */}
        <div role="status" className="space-y-1 empty:hidden">
          {result?.ok === true && (
            <>
              <p className="text-sm text-muted-foreground">
                {t('providers.testChatReply').replace('{model}', model)}
              </p>
              <p className="rounded-xl bg-secondary p-3 text-base whitespace-pre-wrap wrap-anywhere select-text">
                {result.reply}
              </p>
            </>
          )}
          {result?.ok === false && (
            <>
              <p className="text-sm text-muted-foreground">{t('providers.testChatFailed')}</p>
              <p className="rounded-xl bg-secondary p-3 font-mono text-sm text-destructive-text whitespace-pre-wrap wrap-anywhere select-text">
                {'cause' in result
                  ? failureText(t, result.cause)
                  : result.error || t('providers.testChatEmpty')}
              </p>
            </>
          )}
        </div>
        {result?.closed === false && (
          <p className="text-sm text-muted-foreground">{t('providers.testChatKept')}</p>
        )}
        <div className="flex gap-2">
          <Button disabled={busy || !model} onClick={() => void send()}>
            {busy
              ? t('providers.testChatWaiting')
              : result
                ? t('providers.testChatAgain')
                : t('providers.testChatSend')}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            {t('action.close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
