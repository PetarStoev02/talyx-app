import { itemKey } from '@features/bots/roster'
import { useRoster } from '@features/bots/store'
import type { RosterRowRef } from '@features/bots/types'
import { pickedRows } from './picks'

export const ROSTER_DRAG = 'application/x-talyx-roster'

export type RosterDragItem = RosterRowRef

let dragging: RosterDragItem[] = []

/**
 * Starts dragging a roster row; grabbing one of several picked rows drags all of them. The data
 * transfer carries it only so the browser starts a drag.
 */
export function startRosterDrag(event: React.DragEvent, item: RosterDragItem): void {
  event.stopPropagation()
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData(ROSTER_DRAG, JSON.stringify(item))
  const { picked } = useRoster.getState()
  dragging = picked.length > 1 && picked.includes(itemKey(item)) ? pickedRows() : [item]
}

export function endRosterDrag(): void {
  dragging = []
}

// A drop target must know what is coming while it is dragged over, when the browser hides the
// data; drags only start in this window, so the rows are kept here.
export function draggedRows(): RosterDragItem[] {
  return dragging
}
