import { describe, it, expect, vi } from 'vitest'
import { CapabilityRegistry } from '../../../src/main/domain/instruction/model/CapabilityRegistry'
import {
  everydayCapabilities,
  type EverydayCapabilityDeps
} from '../../../src/main/domain/instruction/capabilities/everyday'
import { runCapture } from '../../../src/main/domain/capture/CaptureRunner'
import type { CaptureLogRepo } from '../../../src/main/domain/capture/CaptureLogRepo'
import type { CapabilityContext } from '../../../src/main/domain/instruction/model/Capability'
import type { ActionLog } from '../../../src/main/domain/agent/Brain'

const ctx: CapabilityContext = {
  home: '/Users/test',
  projectsRoot: '/Users/test/Code',
  signal: new AbortController().signal,
  logger: { info: () => {}, warn: () => {} }
}

const NOW = new Date('2026-09-15T10:00:00.000+03:00')

function everydayDeps(): EverydayCapabilityDeps {
  return {
    now: () => NOW,
    calendarEvents: vi.fn(async () => []),
    createReminder: vi.fn(async () => ({ id: 'rem-1' })),
    createNote: vi.fn(async () => ({ id: 'note-1' })),
    createEvent: vi.fn(async () => ({ id: 'ev-1' })),
    deleteEvent: vi.fn(async () => {}),
    saveCaptureFile: vi.fn(async () => ({ path: '/Users/test/Documents/Talyx Capture/x.md' })),
    recentFiles: vi.fn(async () => []),
    extractText: vi.fn(async () => ({ text: '', truncated: false })),
    scanFiles: vi.fn(async () => [])
  }
}

describe('runCapture', () => {
  it('should route to note without Claude, approve, execute, and log', async () => {
    const d = everydayDeps()
    const events: unknown[] = []
    const captureLog = {
      record: vi.fn()
    } as unknown as CaptureLogRepo
    const approve = vi.fn(async () => 'approve' as const)

    const route = await runCapture(
      {
        registry: new CapabilityRegistry(everydayCapabilities(d)),
        ctx,
        log: { append: vi.fn() } as unknown as ActionLog,
        emit: (e) => events.push(e),
        sessionId: 'capture-test',
        approve,
        captureLog,
        findClaude: () => null,
        now: () => NOW
      },
      { text: 'buy filters', chip: null }
    )

    expect(route.destination).toBe('note')
    expect(approve).toHaveBeenCalledOnce()
    expect(d.createNote).toHaveBeenCalledWith({ title: 'buy filters', body: '' })
    expect(captureLog.record).toHaveBeenCalledWith({ destination: 'note', at: NOW })
    expect(events.some((e) => (e as { type: string }).type === 'text')).toBe(true)
  })

  it('should not log when the owner denies', async () => {
    const d = everydayDeps()
    const captureLog = { record: vi.fn() } as unknown as CaptureLogRepo
    await runCapture(
      {
        registry: new CapabilityRegistry(everydayCapabilities(d)),
        ctx,
        log: { append: vi.fn() } as unknown as ActionLog,
        emit: () => {},
        sessionId: 'capture-test',
        approve: async () => 'deny',
        captureLog,
        findClaude: () => null,
        now: () => NOW
      },
      { text: 'buy filters', chip: null }
    )
    expect(d.createNote).not.toHaveBeenCalled()
    expect(captureLog.record).not.toHaveBeenCalled()
  })
})
