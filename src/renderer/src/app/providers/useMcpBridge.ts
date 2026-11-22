import { useEffect, useRef } from 'react'
import { useApprovals } from '@features/bots/store'
import type { RosterBackend } from '@features/bots/data'
import type { ChatActions } from '@features/chat/chat'
import { mcpTools } from '@features/bots/mcp'
import { nameManager } from '@features/bots/details'
import type { BotChatBackend, ShowUiPort } from '@features/bots/mcp'
import { sendToBot } from '@app/providers/moduleChat'
import { registerMcpServer } from '@features/bots/mcpRegistration'
import { botChatId } from '@features/bots/roster'
import type { Bot } from '@features/bots/types'
import { useRoster } from '@features/bots/store'
import { mcpApi } from '@shared/api/ipc'
import { t } from '@shared/lib/i18n'
import { AppError } from '@shared/lib/problem'
import { reportError } from '@shared/lib/report'
import type { McpAnswer } from '@contract/mcp'

/** One bot's chat for the tools: a message goes as a module's page sends it. */
export function botChatBackend(chat: ChatActions): BotChatBackend {
  return {
    sendBotMessage: async (profile, text) => {
      const problem = await sendToBot(chat, profile, text)
      // The chat words its problem for the composer ("back in the box"): an agent gets the cause.
      if (problem) throw new AppError('mcp.errorSend', problem.detail)
    },
    botReplies: chat.recent
  }
}

/**
 * Runs the tool calls agents send Talyx's MCP server, and adds the server to every bot's profile,
 * also to bots created later (here, by an agent, or on another client).
 */
export function useMcpBridge(backend: RosterBackend | null, chat: ChatActions | null): void {
  // One listener for the page's life: while the engine is not connected, a call is answered at
  // once instead of waiting out main's timeout.
  const run = useRef<
    ((tool: string, args: unknown, caller: string | null) => Promise<McpAnswer>) | null
  >(null)
  useEffect(() => {
    const showUi: ShowUiPort = {
      show: async (profile, surface) => (chat ? chat.showSurface(profile, surface) : false)
    }
    run.current =
      backend && chat
        ? mcpTools({ ...backend, ...botChatBackend(chat) }, useApprovals.getState().ask, showUi)
        : null
  }, [backend, chat])
  useEffect(() => {
    const stop = mcpApi.onCall(({ id, tool, args, caller }) => {
      const answered = run.current
        ? run.current(tool, args, caller)
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
    const register = (bots: Bot[]): void => {
      for (const bot of bots.filter((item) => !registered.has(item.name))) {
        registered.add(bot.name)
        connection
          .then((value) =>
            registerMcpServer(backend, { profile: bot.name, sessionId: botChatId(bot) }, value)
          )
          .catch((error: unknown) => {
            // The next start tries again.
            reportError('mcp', error)
          })
        // What the other bots hear the manager called, set beside what lets them reach Talyx.
        void nameManager(backend, bot).catch((error: unknown) => reportError('mcp', error))
      }
    }
    register(useRoster.getState().snapshot.bots)
    return useRoster.subscribe((state) => register(state.snapshot.bots))
  }, [backend])
}
