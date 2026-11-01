import type { OfficeSnapshot } from '../../../../shared/office'

export function roomCounts(
  snapshot: OfficeSnapshot
): { roomId: string; name: string; count: number; groupId: string | null }[] {
  return snapshot.rooms.map((room) => ({
    roomId: room.id,
    name: room.name,
    // Only conference rooms have a chat to open.
    groupId: room.kind === 'conference' ? room.groupId : null,
    count: snapshot.bots.filter((b) => b.placement.roomId === room.id).length
  }))
}
