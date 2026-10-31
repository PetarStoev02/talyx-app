import type { RoomKind } from './model'

export class MissingRoomError extends Error {
  constructor(kind: RoomKind, projectId: string) {
    super(`project ${projectId} has no ${kind} room`)
    this.name = 'MissingRoomError'
  }
}
