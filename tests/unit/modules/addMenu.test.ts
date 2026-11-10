import { describe, expect, it, vi } from 'vitest'
import { createOf } from '../../../src/renderer/src/features/modules/host'
import { addMenu } from '../../../src/renderer/src/widgets/roster/addMenu'

const AGENTS = {
  label: 'Add a bot, a room or a folder',
  actions: [{ label: 'New bot' }, { label: 'New room' }, { label: 'New folder' }]
}

/** A module's renderer.js exports, as Talyx reads them. */
const workflows = (exports: Record<string, unknown>): ReturnType<typeof createOf> =>
  createOf({ default: () => null, ...exports })

describe("the sidebar's +", () => {
  const report = vi.fn()

  it('should add a bot, a room or a folder on the agents', () => {
    expect(addMenu(null, AGENTS, report)).toBe(AGENTS)
  })

  it("should offer the module's own items while its page is open, named as it asks", () => {
    const newTask = vi.fn()
    const create = workflows({
      createLabel: 'Add a task or a workflow',
      createItems: [
        { id: 'task', label: 'New task', icon: 'task', run: newTask },
        { id: 'workflow', label: 'New workflow', icon: 'workflow', run: () => undefined }
      ]
    })
    const menu = addMenu({ create, label: 'Add to Workflows' }, AGENTS, report)
    expect(menu.label).toBe('Add a task or a workflow')
    expect(menu.actions.map((action) => action.label)).toEqual(['New task', 'New workflow'])
    expect(menu.actions.every((action) => action.icon)).toBe(true)
    menu.actions[0].onSelect?.()
    expect(newTask).toHaveBeenCalledOnce()
  })

  it('should read items from a function when the menu opens, named for the module by default', () => {
    const create = workflows({ createItems: () => [{ id: 'a', label: 'New note', run: () => {} }] })
    const menu = addMenu({ create, label: 'Add to Notes' }, AGENTS, report)
    expect(menu).toMatchObject({ label: 'Add to Notes', actions: [{ label: 'New note' }] })
  })

  it.each([
    ['exports no create items', workflows({})],
    ['exports only malformed ones', workflows({ createItems: [{ id: 'x', label: '', run: 1 }] })],
    [
      'names an icon Talyx does not have',
      workflows({ createItems: [{ id: 'x', label: 'X', icon: 'rocket', run: () => {} }] })
    ]
  ])('should keep the agents’ items for a module that %s', (_why, create) => {
    expect(addMenu({ create, label: 'Add to Workflows' }, AGENTS, report)).toBe(AGENTS)
  })

  it('should keep the agents’ items, and report it, when the module’s items fail to load', () => {
    const failing = vi.fn()
    const create = workflows({
      createItems: () => {
        throw new Error('broken module')
      }
    })
    expect(addMenu({ create, label: 'Add to Workflows' }, AGENTS, failing)).toBe(AGENTS)
    expect(failing).toHaveBeenCalledWith(new Error('broken module'))
  })
})
