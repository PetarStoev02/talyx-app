import type { Group } from '../model'
import type { RosterRepo } from '../repository/RosterRepo'

/** Saves a group and gives it a conference room named after it when it has none. */
export class SaveGroup {
  constructor(
    private readonly deps: {
      roster: Pick<RosterRepo, 'saveGroup' | 'listRooms' | 'saveRoom' | 'transaction'>
    }
  ) {}

  execute(group: Group): void {
    const { roster } = this.deps
    roster.transaction(() => {
      roster.saveGroup(group)
      if (roster.listRooms(group.projectId).some((r) => r.groupId === group.id)) return
      roster.saveRoom({
        id: `${group.id}-room`,
        projectId: group.projectId,
        name: group.name,
        kind: 'conference',
        groupId: group.id
      })
    })
  }
}
