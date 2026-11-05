import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '@app/providers/useLanguage'
import {
  cancelSignIn,
  loadProviders,
  startSignIn,
  submitSignInCode,
  waitForSignIn
} from '@features/providers/providers'
import type {
  Account,
  OAuthStartResponse,
  ProvidersBackend,
  SignInResult
} from '@features/providers/providers'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { failureText } from './feedback'

const linkClass = 'text-base underline underline-offset-4 hover:decoration-2'

type Step =
  | { kind: 'starting' }
  | { kind: 'started'; start: OAuthStartResponse }
  | { kind: 'failed'; message: string }

/**
 * One account's sign-in. A device code waits for the browser by itself; a pasted code is
 * submitted here; an account another tool signs in shows that tool's command.
 */
export function SignIn({
  backend,
  account,
  onDone,
  onBack
}: {
  backend: ProvidersBackend
  account: Account
  onDone: () => Promise<void>
  /** Back to the list of accounts, after a sign-in that did not finish. */
  onBack: () => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [step, setStep] = useState<Step>({ kind: 'starting' })
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  // Shown here, not as a toast: the dialog hides toasts from a screen reader.
  const [note, setNote] = useState<string | null>(null)
  const done = useRef(onDone)
  done.current = onDone
  // A pasted code finishes outside the effect; its session must not be cancelled on close.
  const approved = useRef(false)

  // Unmounting (closing the dialog) ends the wait and drops the engine's sign-in session.
  useEffect(() => {
    if (account.flow === 'external') return
    let live = true
    let session: string | null = null
    const finish = (result: SignInResult): void => {
      if (!live) return
      session = null
      if (result.status === 'approved')
        done
          .current()
          .catch((error: unknown) => setStep({ kind: 'failed', message: failureText(t, error) }))
      else if (result.status === 'failed') setStep({ kind: 'failed', message: result.message })
    }
    async function run(): Promise<void> {
      const start = await startSignIn(backend, account.id)
      if (!live) return void cancelSignIn(backend, start.session_id).catch(() => undefined)
      session = start.session_id
      window.open(start.flow === 'device_code' ? start.verification_url : start.auth_url)
      setStep({ kind: 'started', start })
      if (start.flow !== 'device_code') return
      finish(
        await waitForSignIn(backend, {
          providerId: account.id,
          sessionId: start.session_id,
          live: () => live
        })
      )
    }
    run().catch((error: unknown) => finish({ status: 'failed', message: failureText(t, error) }))
    return () => {
      live = false
      if (session && !approved.current) void cancelSignIn(backend, session).catch(() => undefined)
    }
  }, [backend, account.id, account.flow, t])

  async function submit(sessionId: string): Promise<void> {
    setBusy(true)
    try {
      const result = await submitSignInCode(backend, {
        providerId: account.id,
        sessionId,
        code
      })
      if (result.status === 'approved') {
        approved.current = true
        await onDone()
      } else if (result.status === 'failed') setStep({ kind: 'failed', message: result.message })
    } catch (error) {
      setStep({ kind: 'failed', message: failureText(t, error) })
    } finally {
      setBusy(false)
    }
  }

  async function checkAgain(): Promise<void> {
    setBusy(true)
    setNote(null)
    try {
      const { accounts } = await loadProviders(backend)
      if (accounts.some((item) => item.id === account.id && item.signedIn)) await onDone()
      else setNote(t('providers.stillSignedOut'))
    } catch (error) {
      setNote(failureText(t, error))
    } finally {
      setBusy(false)
    }
  }

  if (account.flow === 'external')
    return (
      <div className="space-y-4 text-base">
        <p>{t('providers.signInExternal')}</p>
        <code className="block rounded-lg bg-secondary px-3 py-2 font-mono text-sm select-text">
          {account.command}
        </code>
        <p role="status" className="empty:hidden">
          {note}
        </p>
        <div className="flex items-center gap-4">
          <Button disabled={busy} onClick={() => void checkAgain()}>
            {t('providers.checkAgain')}
          </Button>
          <button
            className={linkClass}
            onClick={() =>
              void navigator.clipboard.writeText(account.command).then(
                () => setNote(t('providers.copied')),
                () => setNote(t('providers.copyFailed'))
              )
            }
          >
            {t('providers.copy')}
          </button>
        </div>
      </div>
    )

  if (step.kind === 'failed')
    return (
      <div role="alert" className="space-y-4 text-base">
        <p>{t('providers.signInFailed').replace('{reason}', step.message)}</p>
        <button className={linkClass} onClick={onBack}>
          {t('providers.signInBack')}
        </button>
      </div>
    )

  if (step.kind === 'starting')
    return (
      <p role="status" className="text-base text-muted-foreground">
        {t('providers.signInStarting')}
      </p>
    )

  const { start } = step
  if (start.flow === 'device_code')
    return (
      <div className="space-y-4 text-base">
        <p>{t('providers.signInWaiting')}</p>
        <p>
          {t('providers.signInCode')}{' '}
          <span className="font-mono text-xl font-semibold select-text">{start.user_code}</span>
        </p>
        <a href={start.verification_url} target="_blank" rel="noreferrer" className={linkClass}>
          {t('providers.signInOpen')}
        </a>
      </div>
    )

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (!busy && code.trim()) void submit(start.session_id)
      }}
    >
      <a href={start.auth_url} target="_blank" rel="noreferrer" className={linkClass}>
        {t('providers.signInOpen')}
      </a>
      <label className="block text-base">
        {t('providers.signInPaste')}
        <Input
          autoFocus
          autoComplete="off"
          spellCheck={false}
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
      </label>
      <Button type="submit" disabled={busy || !code.trim()}>
        {t('providers.signInSubmit')}
      </Button>
    </form>
  )
}
