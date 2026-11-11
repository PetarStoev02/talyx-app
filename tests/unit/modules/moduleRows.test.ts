import { describe, expect, it } from 'vitest'
import { moduleRows } from '../../../src/renderer/src/features/modules/rows'
import { ALL_MODULES, type AvailableModule, type ModulesState } from '../../../src/shared/modules'

const license = { id: 'k', name: 'Ada', modules: ['hello'], expires: null }
const installed = (version: string): ModulesState => ({
  license,
  modules: [
    { id: 'hello', name: 'Hello', version, status: 'running', problem: null, styled: false }
  ]
})
const offered = (version: string, compatible = true): AvailableModule[] => [
  { id: 'hello', name: 'Hello', version, compatible }
]

describe('module rows', () => {
  it('should show nothing without a license', () => {
    expect(moduleRows({ license: null, modules: [] }, offered('1.0.0'))).toEqual([])
  })

  it('should offer Install for an unlocked module that is not installed', () => {
    expect(moduleRows({ license, modules: [] }, offered('1.0.0'))[0]).toMatchObject({
      installed: null,
      action: 'install',
      offered: '1.0.0'
    })
  })

  it('should offer Update when the catalog has another version', () => {
    expect(moduleRows(installed('1.0.0'), offered('1.1.0'))[0]).toMatchObject({
      action: 'update',
      offered: '1.1.0'
    })
  })

  it.each([
    ['the installed version is current', offered('1.0.0')],
    ['the newer version needs another Talyx', offered('1.1.0', false)],
    ['the catalog is still loading', null]
  ])('should offer nothing when %s', (_case, available) => {
    expect(moduleRows(installed('1.0.0'), available)[0]).toMatchObject({
      installed: '1.0.0',
      action: null
    })
  })

  it('should leave out a module that is neither installed nor offered', () => {
    expect(moduleRows({ license, modules: [] }, [])).toEqual([])
  })
})

describe('module rows for a license for every module', () => {
  const everyModule = { ...license, modules: [ALL_MODULES] }

  it('should show the installed modules and the ones the catalog offers', () => {
    const state: ModulesState = { ...installed('1.0.0'), license: everyModule }
    const available = [...offered('1.0.0'), { ...offered('2.0.0')[0]!, id: 'later', name: 'Later' }]

    expect(moduleRows(state, available)).toMatchObject([
      { id: 'hello', installed: '1.0.0', action: null },
      { id: 'later', installed: null, action: 'install', offered: '2.0.0' }
    ])
  })
})

describe('module rows for a key that names several modules', () => {
  const twoModules = { ...license, modules: ['zeta', 'alpha'] }
  const module = (id: string): AvailableModule => ({ ...offered('1.0.0')[0]!, id, name: id })

  it('should keep the order the key names them when the catalog lists them another way', () => {
    const rows = moduleRows({ license: twoModules, modules: [] }, [module('alpha'), module('zeta')])

    expect(rows.map((row) => row.id)).toEqual(['zeta', 'alpha'])
  })

  it('should keep that order when only the later one is installed', () => {
    const state: ModulesState = {
      license: twoModules,
      modules: [{ ...installed('1.0.0').modules[0]!, id: 'alpha', name: 'alpha' }]
    }

    expect(moduleRows(state, [module('alpha'), module('zeta')]).map((row) => row.id)).toEqual([
      'zeta',
      'alpha'
    ])
  })
})

describe('module rows when the catalog was read for an earlier key', () => {
  const module = (id: string): AvailableModule => ({ ...offered('1.0.0')[0]!, id, name: id })

  it('should show no row for an offered module the current key does not unlock', () => {
    const current = { ...license, modules: ['other'] }

    expect(
      moduleRows({ license: current, modules: [] }, [module('hello'), module('later')])
    ).toEqual([])
  })
})
