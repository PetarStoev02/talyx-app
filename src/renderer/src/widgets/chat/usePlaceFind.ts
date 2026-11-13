import { useCallback } from 'react'
import type { SearchPlace } from '@features/chat/botSearch'
import { findIn, useFind } from '@features/chat/findStore'
import type { FindRequest } from '@features/chat/findStore'

/** The find open in this chat or room (AgentsPage ends it when another is selected). */
export function usePlaceFind(
  kind: SearchPlace['kind'],
  id: string
): {
  request: FindRequest | null
  open: () => void
  close: () => void
} {
  const request = useFind((state) => findIn(state.request, { kind, id }))
  const open = useCallback(
    () => useFind.getState().ask({ place: { kind, id }, query: '', messageId: null }),
    [kind, id]
  )
  return { request, open, close: useFind.getState().clear }
}
