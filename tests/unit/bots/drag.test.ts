import { describe, expect, it } from 'vitest'
import {
  draggedRows,
  endRosterDrag,
  startRosterDrag
} from '../../../src/renderer/src/widgets/roster/drag'

type DragStart = Parameters<typeof startRosterDrag>[0]

// Only what a drag start touches.
const dragStart = (): DragStart =>
  ({
    stopPropagation: () => undefined,
    dataTransfer: { effectAllowed: 'all', setData: () => undefined }
  }) as unknown as DragStart

describe('roster drag', () => {
  it('should tell a drop target the rows on their way while the drag is on, and none after', () => {
    const writer = { kind: 'bot', id: 'writer' } as const

    startRosterDrag(dragStart(), writer)
    expect(draggedRows()).toEqual([writer])

    endRosterDrag()
    expect(draggedRows()).toEqual([])
  })
})
