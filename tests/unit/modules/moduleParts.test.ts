import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createItemsOf,
  createOf,
  importModule,
  moduleStyleUrl,
  provideModuleChat
} from '../../../src/renderer/src/features/modules/host'
import { MODULE_API_VERSION } from '../../../src/shared/modules'
import type { ModuleChat } from '../../../src/shared/moduleHost'

// Each module's renderer.js as the dev bridge serves it; every export Talyx reads is listed.
const Hello = (): null => null
const HelloSidebar = (): null => null
const HelloBackground = (): null => null
vi.mock('/bridge/module/hello/renderer.js?v=1.0.0', () => ({
  default: Hello,
  Sidebar: HelloSidebar,
  Background: HelloBackground,
  createLabel: 'Add a greeting',
  createItems: [{ id: 'greet', label: 'New greeting', run: () => undefined }]
}))
vi.mock('/bridge/module/odd/renderer.js?v=2.0.0', () => ({
  default: () => null,
  Sidebar: 'not a component',
  Background: 42,
  createItems: 'not a list'
}))
vi.mock('/bridge/module/blank/renderer.js?v=1.0.0', () => ({ default: 'not a page' }))

const chat = { bots: () => [] } as unknown as ModuleChat

describe("a module's page parts", () => {
  beforeEach(() => {
    vi.stubGlobal('window', { electron: { bridged: true } })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('loading renderer.js', () => {
    it('should load the page, its sidebar, its background and its create items', async () => {
      const parts = await importModule('hello', '1.0.0')

      expect(parts).toMatchObject({
        page: Hello,
        sidebar: HelloSidebar,
        background: HelloBackground
      })
      expect(parts.create?.label).toBe('Add a greeting')
      expect(createItemsOf(parts.create!).map((item) => item.id)).toEqual(['greet'])
    })

    it('should leave out every part that is not of its kind', async () => {
      expect(await importModule('odd', '2.0.0')).toMatchObject({
        sidebar: null,
        background: null,
        create: null
      })
    })

    it('should refuse a module with no page to show', async () => {
      await expect(importModule('blank', '1.0.0')).rejects.toThrow(
        'The blank module has no page to show.'
      )
    })

    it('should give every module one host, with the chat the app provided', async () => {
      provideModuleChat(chat)

      await importModule('hello', '1.0.0')
      const host = window.talyxModuleHost
      await importModule('odd', '2.0.0')

      expect(window.talyxModuleHost).toBe(host)
      expect(host).toMatchObject({ apiVersion: MODULE_API_VERSION, chat })
    })
  })

  describe("a module's files", () => {
    it.each([
      ['over talyx-module:// in the app', false, 'talyx-module://hello/style.css?v=1.0.0'],
      ['through the dev bridge in a browser tab', true, '/bridge/module/hello/style.css?v=1.0.0']
    ])('should load them %s', (_where, bridged, url) => {
      vi.stubGlobal('window', { electron: { bridged } })

      expect(moduleStyleUrl('hello', '1.0.0')).toBe(url)
    })

    it('should escape the version in the URL', () => {
      expect(moduleStyleUrl('hello', '1.0.0+build 7')).toBe(
        '/bridge/module/hello/style.css?v=1.0.0%2Bbuild%207'
      )
    })
  })

  describe('create items', () => {
    const item = { id: 'note', label: 'New note', run: () => undefined }

    it('should offer only the well formed items', () => {
      const create = createOf({
        createItems: [
          item,
          { ...item, id: 7 },
          { ...item, label: ' ' },
          { ...item, id: 'task', icon: 'task' },
          null
        ]
      })

      expect(createItemsOf(create!).map((offered) => offered.id)).toEqual(['note', 'task'])
    })

    it("should read the module's function each time the menu opens", () => {
      let notes = 0
      const create = createOf({
        createItems: () => Array.from({ length: ++notes }, (_, n) => ({ ...item, id: `n${n}` }))
      })

      expect(createItemsOf(create!)).toHaveLength(1)
      expect(createItemsOf(create!)).toHaveLength(2)
    })

    it('should offer nothing when the function gives no list', () => {
      expect(createItemsOf(createOf({ createItems: () => ({ id: 'x' }) })!)).toEqual([])
    })
  })
})
