import { afterEach, describe, expect, it, vi } from 'vitest'
import { useNavigation } from '../../../src/renderer/src/app/providers/useNavigation'
import { setLeaveGuard } from '../../../src/renderer/src/features/modules/leaveGuard'

const WORKFLOWS = 'module:workflows' as const

function openModulePage(): void {
  useNavigation.setState({ currentView: WORKFLOWS })
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('leaving a module page with unsaved work', () => {
  afterEach(() => {
    setLeaveGuard(null)
    useNavigation.setState({ currentView: 'agents' })
  })

  it('should leave at once when the page has no unsaved work', async () => {
    openModulePage()
    useNavigation.getState().navigate('settings')
    await settle()
    expect(useNavigation.getState().currentView).toBe('settings')
  })

  it('should stay on the page when the user keeps editing', async () => {
    openModulePage()
    setLeaveGuard(() => false)
    useNavigation.getState().navigate('agents')
    await settle()
    expect(useNavigation.getState().currentView).toBe(WORKFLOWS)
  })

  it('should leave once the user discards the changes', async () => {
    openModulePage()
    setLeaveGuard(() => Promise.resolve(true))
    useNavigation.getState().navigate('agents')
    await settle()
    expect(useNavigation.getState().currentView).toBe('agents')
  })

  it('should leave when the guard itself fails, so a broken module never traps the user', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    openModulePage()
    setLeaveGuard(() => {
      throw new Error('broken')
    })
    useNavigation.getState().navigate('agents')
    await settle()
    expect(useNavigation.getState().currentView).toBe('agents')
  })

  it('should not ask when navigating from a page that is not a module', async () => {
    const guard = vi.fn(() => false)
    setLeaveGuard(guard)
    useNavigation.getState().navigate('settings')
    expect(useNavigation.getState().currentView).toBe('settings')
    expect(guard).not.toHaveBeenCalled()
  })

  it('should leave when the guard answers with anything but false', async () => {
    openModulePage()
    setLeaveGuard(() => undefined as unknown as boolean)
    expect(await useNavigation.getState().navigate('agents')).toBe(true)
    expect(useNavigation.getState().currentView).toBe('agents')
  })

  it('should not move when the user went elsewhere while the page was asking', async () => {
    openModulePage()
    let answer: (allowed: boolean) => void = () => {}
    setLeaveGuard(() => new Promise<boolean>((resolve) => (answer = resolve)))
    const leaving = useNavigation.getState().navigate('settings')
    useNavigation.setState({ currentView: 'module:notes' })
    answer(true)
    expect(await leaving).toBe(false)
    expect(useNavigation.getState().currentView).toBe('module:notes')
  })

  it('should move only to the last place asked for when the user clicks twice while asked', async () => {
    openModulePage()
    const answers: Array<(allowed: boolean) => void> = []
    setLeaveGuard(() => new Promise<boolean>((resolve) => answers.push(resolve)))
    const first = useNavigation.getState().navigate('agents')
    const second = useNavigation.getState().navigate('settings')
    answers[0](false)
    answers[1](true)
    expect(await first).toBe(false)
    expect(await second).toBe(true)
    expect(useNavigation.getState().currentView).toBe('settings')
  })
})
