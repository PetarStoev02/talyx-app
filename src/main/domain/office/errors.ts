import type { RoomKind } from './model'

export class MissingRoomError extends Error {
  constructor(kind: RoomKind, projectId: string) {
    super(`project ${projectId} has no ${kind} room`)
    this.name = 'MissingRoomError'
  }
}

export class InvalidEventError extends Error {
  constructor(field: string, problem: string) {
    super(`invalid event: ${field} ${problem}`)
    this.name = 'InvalidEventError'
  }
}

export class UnknownBotError extends Error {
  constructor(readonly botId: string) {
    super(`unknown bot ${botId}`)
    this.name = 'UnknownBotError'
  }
}

export class ProjectNotFoundError extends Error {
  constructor(projectId: string) {
    super(`project ${projectId} not found`)
    this.name = 'ProjectNotFoundError'
  }
}
