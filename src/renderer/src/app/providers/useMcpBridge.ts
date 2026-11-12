import { useEffect } from 'react'
import { useApprovals } from '@features/bots/approvals'
import type { RosterBackend } from '@features/bots/data'
import { mcpTools } from '@features/bots/mcp'
import { registerMcpServer } from '@features/bots/mcpRegistration'
import { useRoster } from '@features/bots/store'
import { mcpApi } from '@shared/api/ipc'
import { reportError } from '@shared/lib/report'

/**
 * Runs the tool calls agents send Talyx's MCP server, and adds the server to every bot's profile,
 * also to bots created later (here, by an agent, or on another client).
 */
export function useMcpBridge(backend: RosterBackend | null): void {
  useEffect(() => {
    if (!backend) return
    const run = mcpTools(backend, useApprovals.getState().ask)
    const stop = mcpApi.onCall(({ id, tool, args }) => {
      void run(tool, args).then((answer) => mcpApi.answer(id, answer))
    })
    void mcpApi.attach().catch((error: unknown) => reportError('mcp', error))
    return stop
  }, [backend])

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
