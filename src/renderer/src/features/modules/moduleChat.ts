import { useLanguage } from '@app/providers/useLanguage'
import { MANAGER } from '@features/bots/details'
import { botTitle } from '@features/bots/roster'
import { useRoster } from '@features/bots/store'
import { useChat } from '@features/chat/store'
import type { ChatActions } from '@features/chat/chat'
import { problemText } from '@shared/lib/problem'

/** A bot as a module sees it: its profile id, the name you know it by, and whether it is Talyx. */
export interface ModuleBot {
  id: string
  name: string
  manager: boolean
}

/**
 * The bots' chats, for a module's page: the same path as typing in the chat, so the message shows
 * there, and Talyx's chat answers the bot's questions and approvals as usual.
 */
export interface ModuleChat {
  bots: () => ModuleBot[]
  /** Sends `text` to the bot's chat, starting the chat if it has none. */
  send: (bot: string, text: string) => Promise<void>
  /** The bot's newest replies, oldest first. */
  replies: (bot: string, limit?: number) => Promise<string[]>
}

export class ModuleChatError extends Error {
  override name = 'ModuleChatError'
}

// Far above any brief; a page cannot flood a chat.
const MAX_TEXT = 20_000
const DEFAULT_REPLIES = 40
const MAX_REPLIES = 200

export function moduleChat(actions: () => ChatActions | null): ModuleChat {
  const connected = (): ChatActions => {
    const chat = actions()
    if (!chat) throw new ModuleChatError('Talyx is not connected to its engine yet.')
    return chat
  }
  return {
    bots: () =>
      useRoster.getState().snapshot.bots.map((bot) => ({
        id: bot.name,
        name: botTitle(bot),
        manager: bot.name === MANAGER
      })),
    send: async (bot, text) => {
      const chat = connected()
      knownBot(bot)
      if (typeof text !== 'string' || !text.trim() || text.length > MAX_TEXT)
        throw new ModuleChatError(`A message is 1 to ${MAX_TEXT} characters.`)
      if (await chat.send(bot, { text, images: [] })) return
      const problem = useChat.getState().chats[bot]?.error
      const t = useLanguage.getState().t
      throw new ModuleChatError(problem ? problemText(t, problem) : 'The message was not sent.')
    },
    replies: async (bot, limit = DEFAULT_REPLIES) => {
      const chat = connected()
      knownBot(bot)
      return chat.recent(bot, Math.min(Math.max(1, Math.floor(limit)), MAX_REPLIES))
    }
  }
}

function knownBot(bot: unknown): void {
  if (!useRoster.getState().snapshot.bots.some((known) => known.name === bot))
    throw new ModuleChatError(`There is no bot named "${String(bot)}".`)
}
