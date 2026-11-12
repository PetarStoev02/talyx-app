import { afterEach, describe, expect, it } from 'vitest'
import { type AppView, useNavigation } from '../../../src/renderer/src/app/providers/useNavigation'
import { setLeaveGuard } from '../../../src/renderer/src/features/modules/leaveGuard'

const WORKFLOWS = 'module:workflows' as const

function openSettingsFrom(view: AppView): Promise<boolean> {
  useNavigation.setState({ currentView: view })
  return useNavigation.getState().navigate('settings')
}

describe('leaving Settings', () => {
  afterEach(() => {
    setLeaveGuard(null)
    useNavigation.setState({ currentView: 'agents', settingsFrom: 'agents' })
  })

  it.each<AppView>(['agents', WORKFLOWS])(
    'should go back to %s, the page Settings was opened from',
    async (from) => {
      await openSettingsFrom(from)
      await useNavigation.getState().closeSettings()
      expect(useNavigation.getState().currentView).toBe(from)
    }
  )

  it('should keep the page it was opened from while moving between Settings pages', async () => {
    await openSettingsFrom(WORKFLOWS)
    await useNavigation.getState().navigate('settings')
    await useNavigation.getState().closeSettings()
    expect(useNavigation.getState().currentView).toBe(WORKFLOWS)
  })

  it('should stay put when Settings is not open', async () => {
    useNavigation.setState({ currentView: WORKFLOWS, settingsFrom: 'agents' })
    expect(await useNavigation.getState().closeSettings()).toBe(false)
    expect(useNavigation.getState().currentView).toBe(WORKFLOWS)
  })

  it('should not remember a module page whose guard kept the user there', async () => {
    useNavigation.setState({ currentView: WORKFLOWS })
    setLeaveGuard(() => false)
    await useNavigation.getState().navigate('settings')
    expect(useNavigation.getState()).toMatchObject({
      currentView: WORKFLOWS,
      settingsFrom: 'agents'
    })
  })

  describe('the gear and its shortcut', () => {
    it('should open Settings from a page and close it back to that page', async () => {
      useNavigation.setState({ currentView: WORKFLOWS })
      await useNavigation.getState().toggleSettings()
      expect(useNavigation.getState().currentView).toBe('settings')
      await useNavigation.getState().toggleSettings()
      expect(useNavigation.getState().currentView).toBe(WORKFLOWS)
    })
  })
})
