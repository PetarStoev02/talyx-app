import { useEffect, useRef } from 'react'
import { useApprovals } from '@features/bots/approvals'
import type { RosterBackend } from '@features/bots/data'
import { mcpTools } from '@features/bots/mcp'
import { registerMcpServer } from '@features/bots/mcpRegistration'
import { useRoster } from '@features/bots/store'
import { mcpApi } from '@shared/api/ipc'
import { t } from '@shared/lib/i18n'
import { reportError } from '@shared/lib/report'
import type { McpAnswer } from '../../../../shared/mcp'

/**
 * Runs the tool calls agents send Talyx's MCP server, and adds the server to every bot's profile,
 * also to bots created later (here, by an agent, or on another client).
 */
export function useMcpBridge(backend: RosterBackend | null): void {
  // One listener for the page's life: while the engine is not connected, a call is answered at
  // once instead of waiting out main's timeout.
  const run = useRef<((tool: string, args: unknown) => Promise<McpAnswer>) | null>(null)
  useEffect(() => {
    run.current = backend ? mcpTools(backend, useApprovals.getState().ask) : null
  }, [backend])
  useEffect(() => {
    const stop = mcpApi.onCall(({ id, tool, args }) => {
      const answered = run.current
        ? run.current(tool, args)
        : Promise.resolve({ ok: false, text: t('mcp.errorNoEngine', 'en') })
      void answered.then((answer) => mcpApi.answer(id, answer))
    })
    void mcpApi.attach().catch((error: unknown) => reportError('mcp', error))
    return stop
  }, [])

  useEffect(() => {
    if (!backend) return
    const registered = new Set<string>()
    const connection = mcpApi.connection()
    const register = (profiles: string[]): void => {
      for (const profile of profiles.filter((name) => !registered.has(name))) {
        registered.add(profile)
        connection
          .then((value) => registerMcpServer(backend, profile, value))
          .catch((error: unknown) => {
            // The next start tries again.
            reportError('mcp', error)
          })
      }
    }
    register(useRoster.getState().snapshot.bots.map((bot) => bot.name))
    return useRoster.subscribe((state) => register(state.snapshot.bots.map((bot) => bot.name)))
  }, [backend])
}
