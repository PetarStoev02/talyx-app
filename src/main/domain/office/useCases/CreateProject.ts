import type { Project } from '../model'
import type { RosterRepo } from '../repository/RosterRepo'

export interface CreateProjectDeps {
  roster: Pick<RosterRepo, 'listProjects' | 'saveProject' | 'saveRoom' | 'transaction'>
  /** Validates and copies a chosen logo file; returns the stored path. */
  logos: { store(projectId: string, sourcePath: string): string }
}

/** Saves a project; a new one also gets its default work and chill rooms. */
export class CreateProject {
  constructor(private readonly deps: CreateProjectDeps) {}

  execute(project: Project): void {
    const { roster, logos } = this.deps
    const existing = roster.listProjects().find((p) => p.id === project.id)
    const logoPath =
      project.logoPath && project.logoPath !== existing?.logoPath
        ? logos.store(project.id, project.logoPath)
        : project.logoPath
    roster.transaction(() => {
      roster.saveProject({ ...project, logoPath })
      if (existing) return
      const room = { projectId: project.id, groupId: null }
      roster.saveRoom({ ...room, id: `${project.id}-work`, name: 'Work room', kind: 'work' })
      roster.saveRoom({ ...room, id: `${project.id}-chill`, name: 'Chill room', kind: 'chill' })
    })
  }
}
