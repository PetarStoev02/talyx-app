import { useEffect, useMemo, useState } from 'react'
import { useRoster } from '@features/bots/store'
import { chatActions } from '@features/chat/chat'
import { useCompletionSound } from '@features/chat/completionSound'
import type { ChatActions } from '@features/chat/chat'
import { activityOf, handleEvent, promptHandler } from '@features/chat/events'
import type { ChatUpdate } from '@features/chat/events'
import { useChat } from '@features/chat/store'
import { host } from '@shared/engine/host'
import { engineHttp } from '@shared/engine/http'
import { reportError } from '@shared/lib/report'
import { forgetDeleted } from './forgetDeleted'

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

  useEffect(() => {
    useCompletionSound
      .getState()
      .load()
      .catch((error: unknown) => reportError('settings', error))
  }, [])

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
      // The redial replays the gap; a reload covers a session whose re-resume failed. A turn
      // that ended while the socket was down ends here, so its waiting messages go and the
      // roster stops showing it as working.
      for (const chat of Object.values(useChat.getState().chats)) {
        if (chat.sessionId) void reloadAfterDrop(actions, chat.profile)
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

async function reloadAfterDrop(actions: ChatActions, profile: string): Promise<void> {
  await actions.turnEnded(profile)
  const transcript = useChat.getState().chats[profile]?.transcript
  if (transcript) showOnRoster({ profile, completed: false, activity: activityOf(transcript) })
}

function showOnRoster(update: ChatUpdate | null): void {
  if (!update) return
  const roster = useRoster.getState()
  if (roster.activity[update.profile] !== update.activity)
    roster.setActivity(update.profile, update.activity)
  // The roster ignores this for the selected bot.
  if (update.completed) roster.markUnread(update.profile)
}
