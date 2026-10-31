import { describe, it, expect } from 'vitest'
import { SetFunnel } from '../../../src/main/domain/office/useCases/SetFunnel'

function setup(enableFails = false): { uc: SetFunnel; saved: boolean[]; refreshed: () => number } {
  const saved: boolean[] = []
  let refreshes = 0
  const uc = new SetFunnel({
    enable: async () => {
      if (enableFails) throw new Error('Funnel is not enabled on your tailnet')
    },
    disable: async () => {},
    saveEnabled: (on) => void saved.push(on),
    refresh: async () => void refreshes++
  })
  return { uc, saved, refreshed: () => refreshes }
}

describe('SetFunnel', () => {
  it('should remember funnel on only after enabling worked', async () => {
    const { uc, saved, refreshed } = setup()
    await uc.execute(true)
    expect(saved).toEqual([true])
    expect(refreshed()).toBe(1)
  })

  it('keeps funnel off when enabling fails', async () => {
    const { uc, saved, refreshed } = setup(true)
    await expect(uc.execute(true)).rejects.toThrow('not enabled')
    expect(saved).toEqual([false])
    expect(refreshed()).toBe(1)
  })

  it('should remember funnel off', async () => {
    const { uc, saved } = setup()
    await uc.execute(false)
    expect(saved).toEqual([false])
  })
})
