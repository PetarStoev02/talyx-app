import { describe, it, expect } from 'vitest'
import { SaveGroup } from '../../../src/main/domain/office/useCases/SaveGroup'
import { rosterWithBot } from './rosterUseCases.setup'

describe('SaveGroup', () => {
  it('should create a conference room named after a new group', () => {
    const roster = rosterWithBot()
    new SaveGroup({ roster }).execute({
      id: 'g2',
      projectId: 'p',
      name: 'Clients',
      relayBotId: null
    })
    expect(roster.listRooms('p')).toEqual([
      { id: 'g2-room', projectId: 'p', name: 'Clients', kind: 'conference', groupId: 'g2' }
    ])
  })

  it('should rename a group without adding a second room', () => {
    const roster = rosterWithBot()
    const uc = new SaveGroup({ roster })
    uc.execute({ id: 'g2', projectId: 'p', name: 'Clients', relayBotId: null })
    uc.execute({ id: 'g2', projectId: 'p', name: 'Client panel', relayBotId: null })
    expect(roster.listGroups('p').map((g) => g.name)).toEqual(['Team', 'Client panel'])
    expect(roster.listRooms('p')).toHaveLength(1)
  })
})
