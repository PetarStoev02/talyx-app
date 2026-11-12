import { describe, expect, it } from 'vitest'
import {
  anyUnread,
  dockSections,
  dockShortcut
} from '../../../src/renderer/src/features/modules/sections'
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
const named = (m: ModuleSummary): { label: string; unread: boolean } => ({
  label: m.name,
  unread: false
})

describe('dock sections', () => {
  it('should show no dock without a running module', () => {
    expect(dockSections([], agents, named)).toEqual([])
  })

  it('should list the agents first, then each running module', () => {
    const sections = dockSections(
      [module('workflows', 'Workflows'), module('notes', 'Notes')],
      agents,
      named
    )
    expect(sections.map((section) => [section.label, section.moduleId])).toEqual([
      ['Agents', null],
      ['Workflows', 'workflows'],
      ['Notes', 'notes']
    ])
  })

  it('should carry unread replies on the agents', () => {
    const sections = dockSections(
      [module('workflows', 'Workflows')],
      { label: 'Agents', unread: true },
      named
    )
    expect(sections.map((section) => section.unread)).toEqual([true, false])
  })

  it('should mark a module that has something waiting on you', () => {
    const sections = dockSections(
      [module('workflows', 'Workflows'), module('notes', 'Notes')],
      agents,
      (m) =>
        m.id === 'workflows' ? { label: 'Workflows, 1 waiting on you', unread: true } : named(m)
    )
    expect(sections.map((section) => [section.label, section.unread])).toEqual([
      ['Agents', false],
      ['Workflows, 1 waiting on you', true],
      ['Notes', false]
    ])
  })
})

describe('dock shortcuts', () => {
  const views = ['agents', 'module:workflows']

  it.each([
    ['1', 'agents'],
    ['2', 'module:workflows'],
    ['3', null],
    ['0', null],
    [',', null],
    ['12', null]
  ])('given the key %s, should open %s', (key, expected) => {
    expect(dockShortcut(views, key)).toBe(expected)
  })

  it('should open nothing with an empty dock', () => {
    expect(dockShortcut([], '1')).toBeNull()
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
