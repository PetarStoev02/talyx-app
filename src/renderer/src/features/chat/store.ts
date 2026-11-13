import { create } from 'zustand'
import type { GatewayEvent } from '@shared/engine/shared'
import type { Problem } from '@shared/lib/problem'
import type { ChatDraft } from './chat'
import type { Transcript } from './types'

/** The session's model and reasoning level, as the composer shows them. */
export interface ChatInfo {
  model: string | null
  provider: string | null
  reasoning: string | null
}

/** A message sent while the bot answers: Talyx holds it and sends it when that answer ends. */
export interface WaitingMessage {
  id: string
  draft: ChatDraft
}

export interface ChatState {
  profile: string
  sessionId: string | null
  transcript: Transcript | null
  info: ChatInfo
  // Events that arrived while the chat reloads; null when no load is running.
  pending: GatewayEvent[] | null
  loading: boolean
  // The last action that failed on this chat: what failed and what to do, then the cause.
  error: Problem | null
  // Oldest first; the first goes when the running answer ends.
  waiting: WaitingMessage[]
  // The chat holds every stored message, not only the newest, so a search covers all of it.
  whole: boolean
}

interface ChatStore {
  // One chat per bot, keyed by profile.
  chats: Record<string, ChatState>
  chatForSession: (sessionId: string) => ChatState | null
  update: (profile: string, change: Partial<ChatState>) => void
  /** Drops the chats of deleted bots, so a new bot with one's name starts empty. */
  forget: (profiles: string[]) => void
}

const blank = (profile: string): ChatState => ({
  profile,
  sessionId: null,
  transcript: null,
  info: { model: null, provider: null, reasoning: null },
  pending: null,
  loading: false,
  error: null,
  waiting: [],
  whole: false
})

export const useChat = create<ChatStore>((set, get) => ({
  chats: {},
  chatForSession: (sessionId) =>
    Object.values(get().chats).find((chat) => chat.sessionId === sessionId) ?? null,
  update: (profile, change) =>
    set((state) => ({
      chats: {
        ...state.chats,
        [profile]: { ...(state.chats[profile] ?? blank(profile)), ...change }
      }
    })),
  forget: (profiles) =>
    set((state) => ({
      chats: Object.fromEntries(
        Object.entries(state.chats).filter(([profile]) => !profiles.includes(profile))
      )
    }))
}))
