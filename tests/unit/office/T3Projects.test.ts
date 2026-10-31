import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { T3Projects } from '../../../src/main/infrastructure/office/T3Projects'

describe('T3Projects', () => {
  it('should list live T3 projects by id and name', () => {
    const file = join(mkdtempSync(join(tmpdir(), 't3p-')), 'state.sqlite')
    const db = new Database(file)
    db.exec(`CREATE TABLE projection_projects (project_id TEXT, title TEXT, deleted_at TEXT);
      INSERT INTO projection_projects VALUES ('a', 'Alpha', NULL), ('b', 'Gone', '2026-01-01');`)
    db.close()
    expect(new T3Projects(file).list()).toEqual([{ id: 'a', name: 'Alpha' }])
  })

  it('should return no projects when the T3 database is missing', () => {
    expect(new T3Projects('/nonexistent/statev2.sqlite').list()).toEqual([])
  })
})
