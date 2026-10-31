import type { OfficeSnapshot } from '../../../../shared/office'

export function roomCounts(
  snapshot: OfficeSnapshot
): { roomId: string; name: string; count: number }[] {
  return snapshot.rooms.map((room) => ({
    roomId: room.id,
    name: room.name,
    count: snapshot.bots.filter((b) => b.placement.roomId === room.id).length
  }))
}
