import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UpdateState } from '../../../src/shared/updater'

const updater = vi.hoisted(() => {
  const listeners = new Set<(state: UpdateState) => void>()
  return {
    state: vi.fn(),
    onState: vi.fn((cb: (state: UpdateState) => void) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    }),
    emit: (state: UpdateState) => listeners.forEach((cb) => cb(state))
  }
})
vi.mock('@shared/api/ipc', () => ({ updaterApi: updater }))

import { useUpdates } from '@features/updates/store'

const ready: UpdateState = {
  kind: 'ready',
  release: {
    version: '1.0.1',
    url: 'https://example.test/release',
    publishedAt: '',
    highlights: [],
    changes: 0,
    downloadable: true
  }
}

describe('useUpdates', () => {
  beforeEach(() => useUpdates.setState({ state: { kind: 'none' }, engineInstallRequested: false }))

  it('should hold an engine install request until it is cleared', () => {
    useUpdates.getState().requestEngineInstall()
    expect(useUpdates.getState().engineInstallRequested).toBe(true)
    useUpdates.getState().clearEngineInstall()
    expect(useUpdates.getState().engineInstallRequested).toBe(false)
  })

  it('should load the current state, then follow what main announces', async () => {
    updater.state.mockResolvedValue({ kind: 'none' })
    await useUpdates.getState().load()
    expect(useUpdates.getState().state).toEqual({ kind: 'none' })
    updater.emit(ready)
    expect(useUpdates.getState().state).toEqual(ready)
  })

  it('should keep a state announced while the first read was on its way', async () => {
    updater.state.mockImplementation(async () => {
      updater.emit(ready)
      return { kind: 'none' }
    })
    await useUpdates.getState().load()
    expect(useUpdates.getState().state).toEqual(ready)
  })

  it('should subscribe once however often it loads', async () => {
    updater.state.mockResolvedValue({ kind: 'none' })
    await useUpdates.getState().load()
    await useUpdates.getState().load()
    expect(updater.onState).toHaveBeenCalledTimes(1)
  })
})
