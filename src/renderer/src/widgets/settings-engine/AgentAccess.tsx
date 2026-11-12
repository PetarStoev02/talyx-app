import { useEffect, useState } from 'react'
import { useLanguage } from '@app/providers/useLanguage'
import { CopyButton } from '@features/setup/ScreenParts'
import { mcpApi } from '@shared/api/ipc'
import { reportError } from '@shared/lib/report'
import { mcpAddCommand } from '../../../../shared/mcp'
import type { McpConnection } from '../../../../shared/mcp'

/** How an outside agent reaches Talyx: the address, and a copy of the add line with its token. */
export function AgentAccess(): React.JSX.Element | null {
  const t = useLanguage((s) => s.t)
  const [connection, setConnection] = useState<McpConnection | null>(null)
  useEffect(() => {
    mcpApi
      .connection()
      .then(setConnection)
      .catch((error: unknown) => reportError('mcp', error))
  }, [])
  if (!connection) return null
  return (
    <div className="space-y-2 text-base">
      <h3 className="font-medium text-foreground">{t('settings.agentAccess')}</h3>
      <p>{t('settings.agentAccessHint').replace('{url}', connection.url)}</p>
      <CopyButton
        text={mcpAddCommand(connection)}
        label={t('settings.agentAccessCopy')}
        name={null}
      />
    </div>
  )
}
