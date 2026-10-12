import { describe, it, expect, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../../../src/main/infrastructure/database/migrations'

describe('runMigrations', () => {
  let db: Database.Database

  afterEach(() => {
    db?.close()
  })

  it('should create sort_operations table with correct schema', () => {
    db = new Database(':memory:')
    runMigrations(db)

    const columns = db.prepare("PRAGMA table_info('sort_operations')").all() as {
      name: string
      type: string
      notnull: number
    }[]
    const columnNames = columns.map((c) => c.name)

    expect(columnNames).toContain('id')
    expect(columnNames).toContain('batch_id')
    expect(columnNames).toContain('source_path')
    expect(columnNames).toContain('dest_path')
    expect(columnNames).toContain('operation_type')
    expect(columnNames).toContain('category')
    expect(columnNames).toContain('subcategory')
    expect(columnNames).toContain('file_name')
    expect(columnNames).toContain('file_size')
    expect(columnNames).toContain('created_at')
    expect(columnNames).toContain('original_name')
    expect(columnNames).toContain('new_name')
  })

  it('should create watch_folders table with correct schema', () => {
    db = new Database(':memory:')
    runMigrations(db)

    const columns = db.prepare("PRAGMA table_info('watch_folders')").all() as {
      name: string
      type: string
      notnull: number
    }[]
    const columnNames = columns.map((c) => c.name)

    expect(columnNames).toContain('id')
    expect(columnNames).toContain('path')
    expect(columnNames).toContain('enabled')
    expect(columnNames).toContain('output_path')
    expect(columnNames).toContain('sort_mode')
    expect(columnNames).toContain('created_at')
  })

  it('should create taxonomy_templates table with correct schema', () => {
    db = new Database(':memory:')
    runMigrations(db)

    const columns = db.prepare("PRAGMA table_info('taxonomy_templates')").all() as {
      name: string
      type: string
      notnull: number
    }[]
    const columnNames = columns.map((c) => c.name)

    expect(columnNames).toContain('id')
    expect(columnNames).toContain('name')
    expect(columnNames).toContain('built_in')
    expect(columnNames).toContain('tree_json')
    expect(columnNames).toContain('created_at')
    expect(columnNames).toContain('updated_at')
  })

  it('should create indexes on sort_operations', () => {
    db = new Database(':memory:')
    runMigrations(db)

    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='sort_operations'")
      .all() as { name: string }[]
    const indexNames = indexes.map((i) => i.name)

    expect(indexNames).toContain('idx_sort_operations_batch')
    expect(indexNames).toContain('idx_sort_operations_created')
  })

  it('should enforce operation_type check constraint', () => {
    db = new Database(':memory:')
    runMigrations(db)

    expect(() => {
      db.prepare(
        `INSERT INTO sort_operations (batch_id, source_path, dest_path, operation_type, file_name)
         VALUES ('b1', '/src', '/dst', 'invalid', 'file.txt')`
      ).run()
    }).toThrow()
  })

  it('should enforce unique constraint on watch_folders path', () => {
    db = new Database(':memory:')
    runMigrations(db)

    db.prepare(
      `INSERT INTO watch_folders (path, output_path, sort_mode) VALUES ('/folder', '/out', 'copy')`
    ).run()

    expect(() => {
      db.prepare(
        `INSERT INTO watch_folders (path, output_path, sort_mode) VALUES ('/folder', '/out2', 'copy')`
      ).run()
    }).toThrow()
  })

  it('should be idempotent — running twice does not throw', () => {
    db = new Database(':memory:')

    runMigrations(db)
    runMigrations(db)

    // Should have all tables intact
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[]
    const tableNames = tables.map((t) => t.name)

    expect(tableNames).toContain('sort_operations')
    expect(tableNames).toContain('watch_folders')
    expect(tableNames).toContain('taxonomy_templates')
  })

  it('should preserve existing data when run again', () => {
    db = new Database(':memory:')
    runMigrations(db)

    db.prepare(
      `INSERT INTO watch_folders (path, output_path, sort_mode) VALUES ('/test', '/out', 'copy')`
    ).run()

    // Run migrations again
    runMigrations(db)

    const count = db.prepare('SELECT COUNT(*) as count FROM watch_folders').get() as {
      count: number
    }
    expect(count.count).toBe(1)
  })

  it('should create the agent_actions table', () => {
    db = new Database(':memory:')
    runMigrations(db)

    const cols = db.prepare('PRAGMA table_info(agent_actions)').all() as { name: string }[]
    expect(cols.map((c) => c.name)).toEqual([
      'id',
      'session_id',
      'proposal_id',
      'tool',
      'label',
      'payload',
      'inverse',
      'ok',
      'error',
      'created_at'
    ])
  })
})
