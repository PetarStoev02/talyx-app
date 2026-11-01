import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { ChatMessage, ConversationTarget } from '../../../../shared/office'

interface Conversation {
  messages: ChatMessage[]
  send: (text: string) => Promise<void>
}

/** The messages of one chat, re-read on every office change. */
export function useConversation(target: ConversationTarget): Conversation {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const { kind } = target
  const id = target.kind === 'group' ? target.groupId : target.botId

  const reload = useCallback(async (): Promise<void> => {
    try {
      const current: ConversationTarget =
        kind === 'group' ? { kind, groupId: id } : { kind, botId: id }
      setMessages(await window.api.chatConversation(current))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load the chat')
    }
  }, [kind, id])

  useEffect(() => {
    void reload()
    return window.api.onOfficeChanged(() => void reload())
  }, [reload])

  const send = useCallback(
    async (text: string): Promise<void> => {
      try {
        if (kind === 'group') await window.api.chatSendGroup({ groupId: id, text })
        else await window.api.chatSendDm({ botId: id, text })
      } finally {
        // A failed send is stored too, so it shows with its failed status.
        await reload()
      }
    },
    [kind, id, reload]
  )

  return { messages, send }
}
