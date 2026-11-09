import { describe, expect, it } from 'vitest'
import { anyUnread, sidebarSections } from '../../../src/renderer/src/features/modules/sections'
import type { ModuleSummary } from '../../../src/shared/modules'

const module = (id: string, name: string): ModuleSummary => ({
  id,
  name,
  version: '1.0.0',
  status: 'running',
  problem: null,
  styled: false
})
const agents = { label: 'Agents', unread: false }

describe('sidebar sections', () => {
  it('should show no switch without a running module', () => {
    expect(sidebarSections([], 'agents', agents)).toEqual([])
  })

  it('should list the agents first, then each running module', () => {
    const sections = sidebarSections(
      [module('workflows', 'Workflows'), module('notes', 'Notes')],
      'agents',
      agents
    )
    expect(sections.map((section) => [section.label, section.moduleId])).toEqual([
      ['Agents', null],
      ['Workflows', 'workflows'],
      ['Notes', 'notes']
    ])
  })

  it.each([
    ['agents', 'Agents'],
    ['settings', 'Agents'],
    ['module:workflows', 'Workflows']
  ])('should mark the open section when the view is %s', (view, active) => {
    const sections = sidebarSections([module('workflows', 'Workflows')], view, agents)
    expect(sections.filter((section) => section.active).map((section) => section.label)).toEqual([
      active
    ])
  })

  it('should carry unread replies on the agents only', () => {
    const sections = sidebarSections([module('workflows', 'Workflows')], 'module:workflows', {
      label: 'Agents',
      unread: true
    })
    expect(sections.map((section) => section.unread)).toEqual([true, false])
  })
})

describe('unread replies', () => {
  it.each([
    [[{}, {}], false],
    [[{ talyx: false }, { room: false }], false],
    [[{ talyx: true }, {}], true],
    [[{}, { room: true }], true]
  ])('given %j, should be %s', (marks, expected) => {
    expect(anyUnread(...marks)).toBe(expected)
  })
})
