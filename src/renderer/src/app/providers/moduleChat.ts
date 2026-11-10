import { useEffect } from 'react'
import { useLanguage } from '@app/providers/useLanguage'
import { MANAGER } from '@features/bots/details'
import { lookOf } from '@features/bots/look'
import { botTitle } from '@features/bots/roster'
import { useRoster } from '@features/bots/store'
import { useChat } from '@features/chat/store'
import type { ChatActions } from '@features/chat/chat'
import { provideModuleChat, type ModuleChat } from '@features/modules/host'
import { problemText } from '@shared/lib/problem'

export class ModuleChatError extends Error {
  override name = 'ModuleChatError'
}

// Far above any brief; a page cannot flood a chat.
const MAX_TEXT = 20_000
const DEFAULT_REPLIES = 40
const MAX_REPLIES = 200

// The app's chat right now; the module chat reads it on every call, so a reconnect needs no new host.
let current: ChatActions | null = null

/** Gives module pages the bots' chats, on whichever chat the app has now. */
export function useModuleChat(chat: ChatActions | null): void {
  useEffect(() => provideModuleChat(moduleChat(() => current)), [])
  useEffect(() => {
    current = chat
  }, [chat])
}

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
        manager: bot.name === MANAGER,
        // As the roster draws it: Talyx is its own block, the others their saved look.
        look: bot.name === MANAGER ? { shape: 'talyx', hue: 0, faces: true } : lookOf(bot)
      })),
    send: async (bot, text) => {
      const chat = connected()
      knownBot(bot)
      if (typeof text !== 'string' || !text.trim() || text.length > MAX_TEXT)
        throw new ModuleChatError(`A message is 1 to ${MAX_TEXT} characters.`)
      // As the chat page does: find the bot's chat first, so the send goes there, not a new one.
      if (!useChat.getState().chats[bot]?.sessionId) await chat.open(bot, null)
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
