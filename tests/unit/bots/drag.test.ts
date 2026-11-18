import { describe, expect, it, vi } from 'vitest'
import { useRoster } from '../../../src/renderer/src/features/bots/store'
import type { RosterRowRef } from '../../../src/renderer/src/features/bots/types'
import {
  draggedRows,
  endRosterDrag,
  startRosterDrag
} from '../../../src/renderer/src/widgets/roster/drag'

const writer: RosterRowRef = { kind: 'bot', id: 'writer' }
const standup: RosterRowRef = { kind: 'room', id: 'standup' }

// The picked rows in the order the page shows them; reading that order needs the page.
vi.mock('../../../src/renderer/src/widgets/roster/picks', () => ({
  pickedRows: () => [standup, writer]
}))

type DragStart = Parameters<typeof startRosterDrag>[0]

// Only what a drag start touches.
const dragStart = (): DragStart =>
  ({
    stopPropagation: () => undefined,
    dataTransfer: { effectAllowed: 'all', setData: () => undefined }
  }) as unknown as DragStart

describe('roster drag', () => {
  it('should tell a drop target every row on its way while the drag is on, and none after', () => {
    useRoster.setState({ picked: ['room:standup', 'bot:writer'] })

    startRosterDrag(dragStart(), writer)
    expect(draggedRows()).toEqual([standup, writer])

    endRosterDrag()
    expect(draggedRows()).toEqual([])

    // A row outside the picked ones goes alone.
    const planner: RosterRowRef = { kind: 'bot', id: 'planner' }
    startRosterDrag(dragStart(), planner)
    expect(draggedRows()).toEqual([planner])
    endRosterDrag()
  })
})
