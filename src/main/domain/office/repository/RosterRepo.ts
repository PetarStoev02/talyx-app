import type Database from 'better-sqlite3'
import type { Bot, Group, Project, Room } from '../model'
import { ProjectNotFoundError } from '../errors'

interface ProjectRow {
  id: string
  name: string
  logo_path: string | null
  window_view: Project['windowView']
}
interface BotRow {
  id: string
  project_id: string
  name: string
  color: string
  webhook_url: string | null
  grok_link: string | null
}

const toProject = (r: ProjectRow): Project => ({
  id: r.id,
  name: r.name,
  logoPath: r.logo_path,
  windowView: r.window_view
})

export class RosterRepo {
  constructor(private readonly db: Database.Database) {}

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)()
  }

  listProjects(): Project[] {
    return (this.db.prepare('SELECT * FROM projects ORDER BY rowid').all() as ProjectRow[]).map(
      toProject
    )
  }

  getProject(id: string): Project {
    const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as
      | ProjectRow
      | undefined
    if (!row) throw new ProjectNotFoundError(id)
    return toProject(row)
  }

  saveProject(p: Project): void {
    this.db
      .prepare(
        `INSERT INTO projects (id, name, logo_path, window_view) VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, logo_path = excluded.logo_path,
         window_view = excluded.window_view`
      )
      .run(p.id, p.name, p.logoPath, p.windowView)
  }

  listGroups(projectId: string): Group[] {
    return this.db
      .prepare(
        'SELECT id, project_id AS projectId, name FROM groups WHERE project_id = ? ORDER BY rowid'
      )
      .all(projectId) as Group[]
  }

  saveGroup(g: Group): void {
    this.db
      .prepare(
        `INSERT INTO groups (id, project_id, name) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET project_id = excluded.project_id, name = excluded.name`
      )
      .run(g.id, g.projectId, g.name)
  }

  listBots(projectId: string): Bot[] {
    return this.loadBots('WHERE project_id = ?', [projectId])
  }

  allBots(): Bot[] {
    return this.loadBots('', [])
  }

  saveBot(b: Bot): void {
    this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO bots (id, project_id, name, color, webhook_url, grok_link)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET project_id = excluded.project_id, name = excluded.name,
           color = excluded.color, webhook_url = excluded.webhook_url,
           grok_link = excluded.grok_link`
        )
        .run(b.id, b.projectId, b.name, b.color, b.webhookUrl, b.grokLink)
      this.db.prepare('DELETE FROM bot_groups WHERE bot_id = ?').run(b.id)
      this.db.prepare('DELETE FROM bot_t3_projects WHERE bot_id = ?').run(b.id)
      const addGroup = this.db.prepare('INSERT INTO bot_groups (bot_id, group_id) VALUES (?, ?)')
      for (const g of b.groupIds) addGroup.run(b.id, g)
      const addT3 = this.db.prepare(
        'INSERT INTO bot_t3_projects (bot_id, t3_project_id) VALUES (?, ?)'
      )
      for (const t of b.t3ProjectIds) addT3.run(b.id, t)
    })()
  }

  deleteBot(id: string): void {
    this.db.prepare('DELETE FROM bots WHERE id = ?').run(id)
  }

  listRooms(projectId: string): Room[] {
    return this.db
      .prepare(
        `SELECT id, project_id AS projectId, name, kind, group_id AS groupId
         FROM rooms WHERE project_id = ? ORDER BY rowid`
      )
      .all(projectId) as Room[]
  }

  saveRoom(r: Room): void {
    this.db
      .prepare(
        `INSERT INTO rooms (id, project_id, name, kind, group_id) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET project_id = excluded.project_id, name = excluded.name,
         kind = excluded.kind, group_id = excluded.group_id`
      )
      .run(r.id, r.projectId, r.name, r.kind, r.groupId)
  }

  private loadBots(where: string, params: string[]): Bot[] {
    const rows = this.db
      .prepare(`SELECT * FROM bots ${where} ORDER BY rowid`)
      .all(...params) as BotRow[]
    const groups = this.db
      .prepare('SELECT group_id FROM bot_groups WHERE bot_id = ? ORDER BY rowid')
      .pluck()
    const t3 = this.db
      .prepare('SELECT t3_project_id FROM bot_t3_projects WHERE bot_id = ? ORDER BY rowid')
      .pluck()
    return rows.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      name: r.name,
      color: r.color,
      groupIds: groups.all(r.id) as string[],
      webhookUrl: r.webhook_url,
      t3ProjectIds: t3.all(r.id) as string[],
      grokLink: r.grok_link
    }))
  }
}
