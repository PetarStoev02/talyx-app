import { useCallback, useMemo } from 'react'
import { useOnLeave } from '@shared/hooks/useOnLeave'
import { useLanguage } from '@shared/lib/i18n'
import type { ChatActions } from '@features/chat/chat'
import { botHits } from '@features/chat/botSearch'
import type { SearchPlace } from '@features/chat/botSearch'
import type { RoomActions } from '@features/chat/room'
import { useChat } from '@features/chat/store'
import type { SearchFound } from './ChatSearch'
import { useBotRoomLogs } from './useBotRoomLogs'
import { useManagerName } from './useManagerName'
import { usePlaceFind } from './usePlaceFind'

/**
 * A bot chat's search: what it finds in the chat and in the bot's group chats, and the find open
 * here. However the search ends (closed, or another bot opened), the chat goes back to its newest
 * part.
 */
export function useBotSearch(
  profile: string,
  actions: ChatActions | null,
  rooms: RoomActions | null
): ReturnType<typeof usePlaceFind> & {
  place: SearchPlace
  find: (query: string) => SearchFound
  loadWhole: () => Promise<void>
} {
  const t = useLanguage((s) => s.t)
  const { request, open, close } = usePlaceFind('bot', profile)
  const place = useMemo(() => ({ kind: 'bot' as const, id: profile }), [profile])
  // What the bot said in its group chats, read while the search is open.
  const roomLogs = useBotRoomLogs(profile, rooms, !!request)
  const chatItems = useChat((state) => state.chats[profile]?.transcript?.items)
  const manager = useManagerName()
  const find = useCallback(
    (query: string): SearchFound => ({
      hits: botHits({ profile, chat: chatItems ?? [], rooms: roomLogs.logs ?? [], manager }, query),
      note: !roomLogs.logs ? t('search.searching') : roomLogs.failed ? t('search.roomsFailed') : ''
    }),
    [profile, chatItems, roomLogs, manager, t]
  )
  const loadWhole = useCallback(
    () => actions?.loadWhole(profile) ?? Promise.resolve(),
    [actions, profile]
  )
  useOnLeave(request ? actions : null, (was) => was.keepNewest(profile))
  return { request, open, close, place, find, loadWhole }
}
