import { describe, it, expect } from 'vitest'
import { CreateProject } from '../../../src/main/domain/office/useCases/CreateProject'
import { InvalidLogoError } from '../../../src/main/domain/office/errors'
import type { Project } from '../../../src/main/domain/office/model'
import { emptyRoster } from './rosterUseCases.setup'

const project: Project = { id: 'p', name: 'Farm', logoPath: null, windowView: 'none' }

function setup(): { uc: CreateProject; roster: ReturnType<typeof emptyRoster>; stored: string[] } {
  const roster = emptyRoster()
  const stored: string[] = []
  const logos = {
    store: (projectId: string, source: string): string => {
      if (source.endsWith('.gif')) throw new InvalidLogoError('must be png, jpeg or svg')
      stored.push(source)
      return `/data/logos/${projectId}.png`
    }
  }
  return { uc: new CreateProject({ roster, logos }), roster, stored }
}

describe('CreateProject', () => {
  it('should give a new project a work room and a chill room', () => {
    const { uc, roster } = setup()
    uc.execute(project)
    expect(roster.getProject('p').name).toBe('Farm')
    expect(roster.listRooms('p')).toEqual([
      { id: 'p-work', projectId: 'p', name: 'Work room', kind: 'work', groupId: null },
      { id: 'p-chill', projectId: 'p', name: 'Chill room', kind: 'chill', groupId: null }
    ])
  })

  it('should only update the fields of an existing project', () => {
    const { uc, roster } = setup()
    uc.execute(project)
    uc.execute({ ...project, name: 'Farm 2', windowView: 'city' })
    expect(roster.getProject('p')).toMatchObject({ name: 'Farm 2', windowView: 'city' })
    expect(roster.listRooms('p')).toHaveLength(2)
  })

  it('should store a newly chosen logo and keep an unchanged one', () => {
    const { uc, roster, stored } = setup()
    uc.execute({ ...project, logoPath: '/Users/me/logo.png' })
    expect(roster.getProject('p').logoPath).toBe('/data/logos/p.png')
    uc.execute({ ...roster.getProject('p'), name: 'Renamed' })
    expect(stored).toEqual(['/Users/me/logo.png'])
  })

  it('should save nothing when the logo is refused', () => {
    const { uc, roster } = setup()
    expect(() => uc.execute({ ...project, logoPath: '/x.gif' })).toThrow(InvalidLogoError)
    expect(roster.listProjects()).toEqual([])
  })
})
