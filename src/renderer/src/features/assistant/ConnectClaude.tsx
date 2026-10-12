import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@shared/ui/button'
import { cn } from '@shared/lib/utils'
import { useLanguage } from '@app/providers/useLanguage'
import { settingsApi } from '@shared/api/ipc'
import { agentApi, type AgentStatus, type AssistantProvider } from '@shared/api/agent'

interface ConnectClaudeProps {
  /** Fired after every status refresh, so a caller that also needs the status (Settings'
   *  projects-root section) doesn't have to poll `agentApi` a second time. */
  onStatusChange?: (status: AgentStatus) => void
}

/**
 * The one flow that connects Talyx to a Claude — Claude Code or an API key.
 * Shared by Settings and the first-run welcome step so there is exactly one
 * connect flow, not two that can drift apart.
 */
export function ConnectClaude({ onStatusChange }: ConnectClaudeProps): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [status, setStatus] = useState<AgentStatus | null>(null)
  const [key, setKey] = useState('')
  const [testing, setTesting] = useState(false)
  const provider = status?.provider ?? 'api-key'

  async function refresh(): Promise<void> {
    const s = await agentApi.status()
    setStatus(s)
    onStatusChange?.(s)
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function chooseProvider(next: AssistantProvider): Promise<void> {
    try {
      await settingsApi.set({ assistantProvider: next })
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the brain')
    }
  }

  async function test(): Promise<void> {
    setTesting(true)
    try {
      await agentApi.testApiKey(key)
      toast.success(t('settings.assistant.keyOk'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Key test failed')
    } finally {
      setTesting(false)
    }
  }

  async function testClaudeCode(): Promise<void> {
    setTesting(true)
    try {
      await agentApi.testClaudeCode()
      toast.success(t('settings.assistant.claudeCodeOk'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Claude Code test failed')
    } finally {
      setTesting(false)
    }
  }

  async function save(): Promise<void> {
    try {
      await agentApi.setApiKey(key)
      setKey('')
      await refresh()
      toast.success(t('settings.assistant.keyOk'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the key')
    }
  }

  async function removeKey(): Promise<void> {
    try {
      await agentApi.clearApiKey()
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove the key')
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
          {t('settings.assistant.provider')}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">{t('settings.assistant.providerHelp')}</p>
        <div className="mt-3 inline-flex rounded-lg border border-border bg-card p-0.5">
          {(['claude-code', 'api-key'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={provider === option}
              onClick={() => void chooseProvider(option)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm transition-colors',
                provider === option
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t(
                option === 'api-key'
                  ? 'settings.assistant.providerApiKey'
                  : 'settings.assistant.providerClaudeCode'
              )}
            </button>
          ))}
        </div>
      </div>

      {provider === 'claude-code' ? (
        <div>
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            {t('settings.assistant.providerClaudeCode')}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('settings.assistant.claudeCodeHelp')}
          </p>
          <ClaudeCodeSetup
            status={status}
            onChanged={refresh}
            onTest={testClaudeCode}
            testing={testing}
          />
        </div>
      ) : (
        <div>
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            {t('settings.assistant.apiKey')}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">{t('settings.assistant.apiKeyHelp')}</p>
          <div className="mt-3 flex gap-2">
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={status?.hasApiKey ? '••••••••••••••••' : 'sk-ant-…'}
              className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={test}
              disabled={testing || key.length < 10}
            >
              {t('settings.assistant.test')}
            </Button>
            <Button size="sm" onClick={save} disabled={key.length < 10}>
              {t('settings.assistant.save')}
            </Button>
          </div>
          {status?.hasApiKey && (
            <Button variant="ghost" size="sm" className="mt-2 text-destructive" onClick={removeKey}>
              {t('settings.assistant.remove')}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Getting Claude Code installed and signed in without ever opening a terminal:
 * the whole point of the assistant is that the owner does not have to.
 */
function ClaudeCodeSetup({
  status,
  onChanged,
  onTest,
  testing
}: {
  status: AgentStatus | null
  onChanged: () => Promise<void>
  onTest: () => Promise<void>
  testing: boolean
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [busy, setBusy] = useState<'install' | 'login' | null>(null)
  const [progress, setProgress] = useState('')

  useEffect(() => agentApi.onInstallProgress(setProgress), [])

  async function install(): Promise<void> {
    setBusy('install')
    setProgress('')
    try {
      await agentApi.installClaudeCode()
      await onChanged()
      toast.success(t('settings.assistant.installDone'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('settings.assistant.installFailed'))
    } finally {
      setBusy(null)
      setProgress('')
    }
  }

  async function signIn(): Promise<void> {
    setBusy('login')
    try {
      const auth = await agentApi.loginClaudeCode()
      await onChanged()
      toast.success(auth.email ?? t('settings.assistant.signedIn'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('settings.assistant.signInFailed'))
    } finally {
      setBusy(null)
    }
  }

  if (!status) return <></>

  if (!status.claudeCode.found) {
    return (
      <div className="mt-3 space-y-2">
        <p className="text-xs text-muted-foreground">{t('settings.assistant.installIntro')}</p>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={install} disabled={busy !== null}>
            {busy === 'install'
              ? t('settings.assistant.installing')
              : t('settings.assistant.install')}
          </Button>
          <code className="truncate rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
            {status.installCommand}
          </code>
        </div>
        {progress && <p className="truncate font-mono text-xs text-muted-foreground">{progress}</p>}
      </div>
    )
  }

  if (!status.claudeCode.auth.loggedIn) {
    return (
      <div className="mt-3 space-y-2">
        <p className="text-xs text-muted-foreground">{t('settings.assistant.signInIntro')}</p>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={signIn} disabled={busy !== null}>
            {busy === 'login' ? t('settings.assistant.signingIn') : t('settings.assistant.signIn')}
          </Button>
          {busy === 'login' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void agentApi.cancelClaudeCodeLogin().then(() => setBusy(null))}
            >
              {t('common.cancel')}
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <div className="flex-1 truncate rounded-lg border border-border bg-card px-3 py-2 text-xs">
        <span className="text-foreground">
          {t('settings.assistant.signedInAs')} {status.claudeCode.auth.email ?? '—'}
        </span>
        <span className="ml-2 text-muted-foreground">
          {status.claudeCode.auth.plan ?? ''} · {status.claudeCode.version ?? ''}
        </span>
      </div>
      <Button variant="outline" size="sm" onClick={onTest} disabled={testing}>
        {t('settings.assistant.test')}
      </Button>
    </div>
  )
}
