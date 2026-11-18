import fc from 'fast-check'
import { describe, expect, it, vi } from 'vitest'
import { createOf } from '../../../src/renderer/src/features/modules/host'
import { addMenu } from '../../../src/renderer/src/widgets/roster/addMenu'
import { MODULE_CREATE_ICONS } from '../../../src/shared/moduleHost'

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

  it('should never let a broken module break the menu, whatever its create items are', () => {
    // Mostly well formed, so the items that get through the filter are often the near misses.
    const often = <T>(arbitrary: fc.Arbitrary<T>): fc.Arbitrary<T | unknown> =>
      fc.oneof({ weight: 4, arbitrary }, fc.anything())
    // Items as a module might export them: well formed, half formed, junk, or a getter that throws.
    const item = fc.oneof(
      fc.record({
        id: often(fc.string()),
        label: often(fc.constantFrom('New task', '', '  ')),
        run: often(fc.constant(() => undefined)),
        icon: often(fc.constantFrom(undefined, ...MODULE_CREATE_ICONS))
      }),
      fc.anything(),
      fc.constant(
        Object.defineProperty({ id: 'x', run: () => undefined }, 'label', {
          get: () => {
            throw new Error('broken getter')
          }
        })
      )
    )
    const value = fc.oneof(fc.array(item, { maxLength: 4 }), fc.anything())
    const exported = fc.oneof(
      value,
      value.map((items) => () => items),
      fc.constant(() => {
        throw new Error('broken module')
      })
    )
    fc.assert(
      fc.property(exported, (createItems) => {
        const create = workflows({ createItems })
        const menu = addMenu({ create, label: 'Add to Workflows' }, AGENTS, () => undefined)
        if (menu === AGENTS) return
        expect(menu.actions.length).toBeGreaterThan(0)
        for (const action of menu.actions) {
          expect(typeof action.label === 'string' && action.label.trim()).toBeTruthy()
          expect(action.onSelect).toBeTypeOf('function')
        }
      })
    )
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
