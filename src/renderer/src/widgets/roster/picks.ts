import { itemKey, rowOf, stepChat } from '@features/bots/roster'
import { useRoster } from '@features/bots/store'
import type { RosterItemRef, RosterRowRef } from '@features/bots/types'
import { platformOf } from '@features/shortcuts/shortcuts'

const isMac = platformOf(navigator.platform) === 'mac'

/** Every row the roster shows, top to bottom; the rows of a closed folder are not on the page. */
function shownKeys(): string[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('[data-roster-row]'),
    (row) => row.dataset.rosterRow ?? ''
  )
}

/** The picked rows in the order they show; one in a folder closed since goes last. */
export function pickedRows(): RosterRowRef[] {
  const shown = shownKeys()
  const rank = (key: string): number => {
    const index = shown.indexOf(key)
    return index < 0 ? shown.length : index
  }
  return [...useRoster.getState().picked].sort((a, b) => rank(a) - rank(b)).map(rowOf)
}

/**
 * A click on a row, as in Finder: Shift picks the range from the last clicked row (or the open
 * chat) across folders, ⌘ (Ctrl on Linux) picks or unpicks this row, and a plain click clears the
 * picked rows and does the row's own thing.
 */
export function clickRow(event: React.MouseEvent, row: RosterRowRef, plain: () => void): void {
  const key = itemKey(row)
  const { picked, pickAnchor, selection, pick } = useRoster.getState()
  const shown = shownKeys()
  const open = selection && shown.includes(itemKey(selection)) ? itemKey(selection) : null
  if (event.shiftKey) {
    const anchor = pickAnchor && shown.includes(pickAnchor) ? pickAnchor : (open ?? key)
    const [from, to] = [shown.indexOf(anchor), shown.indexOf(key)].sort((a, b) => a - b)
    pick(shown.slice(from, to + 1), anchor)
  } else if (isMac ? event.metaKey : event.ctrlKey) {
    // The first ⌘+click adds to the open chat's row, as Finder adds to what is selected.
    const base = picked.length || !open ? picked : [open]
    pick(base.includes(key) ? base.filter((item) => item !== key) : [...base, key], key)
  } else {
    pick([], key)
    plain()
  }
}

/** Opens the bot or room `step` rows from the open one (⌥↑ and ⌥↓), as a click on its row would. */
export function switchChat(step: 1 | -1): void {
  const { selection, select, clearError, pick } = useRoster.getState()
  const key = stepChat(shownKeys(), selection && itemKey(selection), step)
  if (!key) return
  clearError()
  pick([], key)
  select(rowOf(key) as RosterItemRef)
  document
    .querySelector(`[data-roster-row="${CSS.escape(key)}"]`)
    ?.scrollIntoView({ block: 'nearest' })
}
