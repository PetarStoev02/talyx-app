import { useCallback } from 'react'

/**
 * Returns `focus(cursor)`: on the next frame, once the text just set is in `field`, it focuses
 * `field` and puts the cursor at `cursor`, or at the end when `cursor` is null.
 */
export function useFocusLater(
  field: React.RefObject<HTMLTextAreaElement | null>
): (cursor: number | null) => void {
  return useCallback(
    (cursor) => {
      requestAnimationFrame(() => {
        field.current?.focus()
        const at = cursor ?? field.current?.value.length ?? 0
        field.current?.setSelectionRange(at, at)
      })
    },
    [field]
  )
}
