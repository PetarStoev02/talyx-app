export const ROSTER_DRAG = 'application/x-talyx-roster'

export interface RosterDragItem {
  kind: 'bot' | 'room' | 'folder'
  id: string
}

let dragging: RosterDragItem | null = null

/** Starts dragging a roster item. The data transfer carries it only so the browser starts a drag. */
export function startRosterDrag(event: React.DragEvent, item: RosterDragItem): void {
  event.stopPropagation()
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData(ROSTER_DRAG, JSON.stringify(item))
  dragging = item
}

export function endRosterDrag(): void {
  dragging = null
}

// A drop target must know what is coming while it is dragged over, when the browser hides the
// data; drags only start in this window, so the item is kept here.
export function draggedItem(): RosterDragItem | null {
  return dragging
}
