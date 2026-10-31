import { describe, it, expect, vi, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { T3Projects } from '../../../src/main/infrastructure/office/T3Projects'

function stateDb(): string {
  const file = join(mkdtempSync(join(tmpdir(), 't3p-')), 'state.sqlite')
  const db = new Database(file)
  db.exec(`CREATE TABLE projection_projects (project_id TEXT, title TEXT, deleted_at TEXT);
    INSERT INTO projection_projects VALUES ('a', 'Alpha', NULL), ('b', 'Gone', '2026-01-01');`)
  db.close()
  return file
}

function addProject(file: string): void {
  const db = new Database(file)
  db.exec(`INSERT INTO projection_projects VALUES ('c', 'Charlie', NULL)`)
  db.close()
}

describe('T3Projects', () => {
  afterEach(() => vi.useRealTimers())

  it('should list live T3 projects by id and name', () => {
    expect(new T3Projects(stateDb()).list()).toEqual([{ id: 'a', name: 'Alpha' }])
  })

  it('should reuse the project list for a minute before reading the database again', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const file = stateDb()
    const projects = new T3Projects(file)
    expect(projects.list()).toHaveLength(1)
    addProject(file)
    vi.advanceTimersByTime(59_000)
    expect(projects.list()).toHaveLength(1)
    vi.advanceTimersByTime(2_000)
    expect(projects.list()).toHaveLength(2)
  })

  it('should return no projects when the T3 database is missing', () => {
    expect(new T3Projects('/nonexistent/statev2.sqlite').list()).toEqual([])
  })
})
