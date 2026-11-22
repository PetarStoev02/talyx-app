import { useEffect } from 'react'
import { useLanguage } from '@shared/lib/i18n'
import { MANAGER } from '@features/bots/details'
import { lookOf } from '@features/bots/look'
import { botTitle } from '@features/bots/roster'
import { useRoster } from '@features/bots/store'
import { useChat } from '@features/chat/store'
import type { ChatActions } from '@features/chat/chat'
import type { ModuleChat } from '@contract/moduleHost'
import { provideModuleChat } from '@features/modules/host'
import { problemText } from '@shared/lib/problem'
import type { Problem } from '@shared/lib/problem'

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
      const problem = await sendToBot(chat, bot, text)
      if (problem) throw new ModuleChatError(problemText(useLanguage.getState().t, problem))
    },
    replies: async (bot, limit = DEFAULT_REPLIES) => {
      const chat = connected()
      knownBot(bot)
      return chat.recent(bot, Math.min(Math.max(1, Math.floor(limit)), MAX_REPLIES))
    }
  }
}

/**
 * Sends `text` to the bot's chat for a caller that has no composer (a module's page, an agent):
 * behind an answer under way, never cutting into it. The chat's problem when it did not go.
 */
export async function sendToBot(
  chat: ChatActions,
  bot: string,
  text: string
): Promise<Problem | null> {
  // As the chat page does: find the bot's chat first, so the send goes there, not a new one.
  if (!useChat.getState().chats[bot]?.sessionId) await chat.open(bot, null)
  if (await chat.send(bot, { text, images: [], whenBusy: 'queue', replaces: null })) return null
  return useChat.getState().chats[bot]?.error ?? { key: 'chat.errorSend', detail: null }
}

function knownBot(bot: unknown): void {
  if (!useRoster.getState().snapshot.bots.some((known) => known.name === bot))
    throw new ModuleChatError(`There is no bot named "${String(bot)}".`)
}
