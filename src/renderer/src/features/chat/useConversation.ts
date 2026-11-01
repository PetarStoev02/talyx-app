import { useCallback, useEffect, useRef, useState } from 'react'
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

  // Reloads can overlap (office pushes, a send's reload); only the latest may set state.
  const latestRequest = useRef(0)
  const failing = useRef(false)

  const reload = useCallback(async (): Promise<void> => {
    const request = ++latestRequest.current
    const current: ConversationTarget =
      kind === 'group' ? { kind, groupId: id } : { kind, botId: id }
    try {
      const loaded = await window.api.chatConversation(current)
      if (request !== latestRequest.current) return
      failing.current = false
      setMessages(loaded)
    } catch (err) {
      if (request !== latestRequest.current || failing.current) return
      failing.current = true // toast once per failure streak, not on every push
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
