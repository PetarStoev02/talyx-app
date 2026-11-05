import { useEffect, useMemo, useState } from 'react'
import { useRoster } from '@features/bots/store'
import type { RosterState } from '@features/bots/store'
import { chatActions } from '@features/chat/chat'
import type { ChatActions } from '@features/chat/chat'
import { handleEvent, promptHandler } from '@features/chat/events'
import type { ChatUpdate } from '@features/chat/events'
import { useRooms } from '@features/chat/roomStore'
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

  useEffect(() => useRoster.subscribe(forgetDeleted), [])

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
      // Providers may have changed while the engine was away.
      actions.forgetModels()
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

// A bot or room gone from the roster takes its chat or view along.
function forgetDeleted({ snapshot }: RosterState, { snapshot: previous }: RosterState): void {
  if (snapshot === previous) return
  const bots = new Set(snapshot.bots.map((bot) => bot.name))
  const rooms = new Set(snapshot.rooms.map((room) => room.room_id))
  const goneBots = previous.bots.map((bot) => bot.name).filter((name) => !bots.has(name))
  const goneRooms = previous.rooms.map((room) => room.room_id).filter((id) => !rooms.has(id))
  if (goneBots.length > 0) useChat.getState().forget(goneBots)
  if (goneRooms.length > 0) useRooms.getState().forget(goneRooms)
}

function showOnRoster(update: ChatUpdate | null): void {
  if (!update) return
  const roster = useRoster.getState()
  if (roster.activity[update.profile] !== update.activity)
    roster.setActivity(update.profile, update.activity)
  // The roster ignores this for the selected bot.
  if (update.completed) roster.markUnread(update.profile)
}
