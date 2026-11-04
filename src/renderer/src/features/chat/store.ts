import { create } from 'zustand'
import type { Transcript } from './types'

/** The session's model and reasoning level, as the composer shows them. */
export interface ChatInfo {
  model: string | null
  provider: string | null
  reasoning: string | null
}

export interface ChatState {
  profile: string
  sessionId: string | null
  transcript: Transcript | null
  info: ChatInfo
  loading: boolean
  error: string | null
}

interface ChatStore {
  // One chat per bot, keyed by profile.
  chats: Record<string, ChatState>
  chatForSession: (sessionId: string) => ChatState | null
  update: (profile: string, change: Partial<ChatState>) => void
}

const blank = (profile: string): ChatState => ({
  profile,
  sessionId: null,
  transcript: null,
  info: { model: null, provider: null, reasoning: null },
  loading: false,
  error: null
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
    }))
}))
