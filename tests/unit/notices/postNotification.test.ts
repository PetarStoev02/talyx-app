import { describe, it, expect, vi, beforeEach } from 'vitest'

type Listener = (...args: unknown[]) => void

const created: Array<{
  options: unknown
  listeners: Map<string, Listener>
  show: ReturnType<typeof vi.fn>
}> = []
const supported = { value: true }

vi.mock('electron', () => {
  class Notification {
    static isSupported(): boolean {
      return supported.value
    }
    listeners = new Map<string, Listener>()
    show = vi.fn()
    constructor(options: unknown) {
      created.push({ options, listeners: this.listeners, show: this.show })
    }
    on(event: string, listener: Listener): this {
      this.listeners.set(event, listener)
      return this
    }
  }
  return { Notification }
})

const warn = vi.fn()
vi.mock('electron-log', () => ({ default: { warn: (m: string) => warn(m) } }))

import { postNotification } from '../../../src/main/infrastructure/notices/postNotification'

describe('postNotification', () => {
  beforeEach(() => {
    created.length = 0
    supported.value = true
    warn.mockClear()
  })

  it('should show the title and body', () => {
    postNotification({ title: 'File Sorted', body: 'a.pdf → Documents' })

    expect(created).toHaveLength(1)
    expect(created[0].options).toEqual({ title: 'File Sorted', body: 'a.pdf → Documents' })
    expect(created[0].show).toHaveBeenCalledOnce()
  })

  it('should post nothing when the system has no notifications', () => {
    supported.value = false

    postNotification({ title: 'File Sorted', body: 'a.pdf → Documents' })

    expect(created).toHaveLength(0)
  })

  it('should log the reason when macOS refuses to deliver it', () => {
    postNotification({ title: 'Notices are on', body: 'Private body text' })

    created[0].listeners.get('failed')?.({}, 'Notifications are not allowed for this application')

    expect(warn).toHaveBeenCalledWith(
      '[Notification] not delivered: Notifications are not allowed for this application'
    )
    expect(warn.mock.calls[0][0]).not.toContain('Private body text')
  })

  it('should run the click action when one is given', () => {
    const onClick = vi.fn()

    postNotification({ title: 'Briefing', body: 'Two things' }, onClick)
    created[0].listeners.get('click')?.({})

    expect(onClick).toHaveBeenCalledOnce()
  })

  it('should end its hold on the notification when it closes or fails', () => {
    postNotification({ title: 'Briefing', body: 'Two things' })

    expect(created[0].listeners.has('close')).toBe(true)
    expect(() => created[0].listeners.get('close')?.({})).not.toThrow()
    expect(() => created[0].listeners.get('failed')?.({}, 'denied')).not.toThrow()
  })

  it('should listen for no click when none is given', () => {
    postNotification({ title: 'Briefing', body: 'Two things' })

    expect(created[0].listeners.has('click')).toBe(false)
  })
})
