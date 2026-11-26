import { beforeEach, describe, expect, it } from 'vitest'
import type { SidebarLayout } from '../../../src/shared/channels'
import { useLayoutPick } from '../../../src/renderer/src/features/settings/store'
import {
  loadLayout,
  pickLayout,
  type LayoutBackend
} from '../../../src/renderer/src/features/settings/layout'

// The saved settings, as main keeps them; `read` holds the read open until the test lets it go.
function settingsWith(layout: SidebarLayout): {
  backend: LayoutBackend
  saved: SidebarLayout[]
  release: () => void
} {
  const saved: SidebarLayout[] = []
  let release = (): void => undefined
  const opened = new Promise<void>((resolve) => (release = resolve))
  return {
    saved,
    release: () => release(),
    backend: {
      get: async () => {
        await opened
        return layout === null
          ? ({} as { sidebarLayout: SidebarLayout })
          : { sidebarLayout: layout }
      },
      save: ({ sidebarLayout }) => void saved.push(sidebarLayout)
    }
  }
}

describe('sidebar layout', () => {
  beforeEach(() => useLayoutPick.getState().reset())

  describe('loadLayout', () => {
    it.each(['dock', 'layered'] as const)('should show the saved %s layout', async (layout) => {
      const settings = settingsWith(layout)
      settings.release()
      await loadLayout(settings.backend)
      expect(useLayoutPick.getState().layout).toBe(layout)
    })

    it('should keep a pick made while the saved one was being read', async () => {
      const settings = settingsWith('dock')
      const loading = loadLayout(settings.backend)
      pickLayout(settings.backend, 'layered')
      settings.release()
      await loading
      expect(useLayoutPick.getState().layout).toBe('layered')
    })
  })

  describe('pickLayout', () => {
    it('should show and save the pick', () => {
      const settings = settingsWith('dock')
      pickLayout(settings.backend, 'layered')
      expect(useLayoutPick.getState().layout).toBe('layered')
      expect(settings.saved).toEqual(['layered'])
    })
  })
})
