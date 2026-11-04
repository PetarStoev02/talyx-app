import { useEffect, useMemo, useState } from 'react'
import { useRoster } from '@features/bots/store'
import { chatActions } from '@features/chat/chat'
import type { ChatActions } from '@features/chat/chat'
import { handleEvent, promptHandler } from '@features/chat/events'
import type { ChatUpdate } from '@features/chat/events'
import { useChat } from '@features/chat/store'
import { host } from '@shared/engine/host'
import { engineHttp } from '@shared/engine/http'

/**
 * The chat's engine access, once the socket has opened once. Use it in one place: it routes
 * every session event and card into the open chats and the roster's unread and activity marks.
 */
export function useChatBackend(): ChatActions | null {
  const [opened, setOpened] = useState(false)

  useEffect(
    () =>
      host.onState((state) => {
        if (state === 'open') setOpened(true)
      }),
    []
  )

  const actions = useMemo(
    () => (opened ? chatActions({ request: host.request, http: engineHttp }) : null),
    [opened]
  )

  useEffect(() => {
    if (!actions) return
    let dropped = false
    const offEvent = host.onEvent((event) => showOnRoster(handleEvent(actions, event)))
    const offPrompt = host.onPrompt(promptHandler(showOnRoster))
    const offState = host.onState((state) => {
      if (state === 'closed' || state === 'error') dropped = true
      if (state !== 'open' || !dropped) return
      dropped = false
      // The redial replays the gap; a reload covers a session whose re-resume failed.
      for (const chat of Object.values(useChat.getState().chats)) {
        if (chat.sessionId) void actions.rebuild(chat.profile)
      }
    })
    return () => {
      offEvent()
      offPrompt()
      offState()
    }
  }, [actions])

  return actions
}

function showOnRoster(update: ChatUpdate | null): void {
  if (!update) return
  const roster = useRoster.getState()
  if (roster.activity[update.profile] !== update.activity)
    roster.setActivity(update.profile, update.activity)
  // The roster ignores this for the selected bot.
  if (update.completed) roster.markUnread(update.profile)
}
