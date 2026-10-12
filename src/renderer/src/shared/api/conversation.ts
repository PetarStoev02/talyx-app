export interface Conversation {
  id: string
  title: string
  startedAt: number
  updatedAt: number
}

/** The transcript entry as stored: its kind, and the rest of the entry as payload. */
export interface StoredEntry {
  kind: string
  payload: unknown
}

export const conversationApi = {
  list: (): Promise<Conversation[]> => window.api.conversationList() as Promise<Conversation[]>,
  open: async (id: string): Promise<StoredEntry[]> => {
    const { entries } = await (window.api.conversationOpen(id) as Promise<{
      entries: StoredEntry[]
    }>)
    return entries
  },
  remove: (id: string): Promise<void> => window.api.conversationDelete(id) as Promise<void>,
  removeAll: (): Promise<void> => window.api.conversationDeleteAll() as Promise<void>
}
