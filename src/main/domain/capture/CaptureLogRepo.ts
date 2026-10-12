import { randomUUID } from 'crypto'
import type Database from 'better-sqlite3'
import type { CaptureDestination } from '../../domain/capture/CaptureTypes'

export interface CaptureLogEntry {
  id: string
  savedAt: string
  destination: CaptureDestination
  dayKey: string
}

/** Local calendar day key YYYY-MM-DD for habit counting. */
export function captureDayKey(at: Date): string {
  const pad = (n: number): string => n.toString().padStart(2, '0')
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
}

export class CaptureLogRepo {
  constructor(private readonly db: Database.Database) {}

  record(input: { destination: CaptureDestination; at: Date }): CaptureLogEntry {
    const entry: CaptureLogEntry = {
      id: randomUUID(),
      savedAt: input.at.toISOString(),
      destination: input.destination,
      dayKey: captureDayKey(input.at)
    }
    this.db
      .prepare(`INSERT INTO capture_log (id, saved_at, destination, day_key) VALUES (?, ?, ?, ?)`)
      .run(entry.id, entry.savedAt, entry.destination, entry.dayKey)
    return entry
  }
}
