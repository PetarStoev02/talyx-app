import { describe, it, expect, vi } from 'vitest'
import { routeCapture } from '../../../src/main/domain/capture/CaptureRouter'
import type { RouteCaptureInput } from '../../../src/main/domain/capture/CaptureTypes'

process.env.TZ = 'Europe/Sofia'

const NOW = new Date('2026-09-15T10:00:00.000+03:00')

function input(overrides: Partial<RouteCaptureInput> = {}): RouteCaptureInput {
  return {
    text: 'buy coffee filters',
    chip: null,
    claude: null,
    now: NOW,
    signal: new AbortController().signal,
    ...overrides
  }
}

describe('routeCapture', () => {
  it('should fall back to note when Claude is unavailable', async () => {
    const route = await routeCapture(input())
    expect(route.destination).toBe('note')
    expect(route.tool).toBe('take_note')
    expect(route.input).toEqual({ title: 'buy coffee filters', body: '' })
  })

  it('should honour a reminder chip without Claude', async () => {
    const route = await routeCapture(input({ chip: 'reminder' }))
    expect(route.destination).toBe('reminder')
    expect(route.tool).toBe('remind_me')
    expect(route.input.due).toBeNull()
  })

  it('should fall back to note when Claude returns bad JSON', async () => {
    const route = await routeCapture(
      input({
        claude: {
          complete: async () => ({ text: 'not json at all' })
        }
      })
    )
    expect(route.destination).toBe('note')
    expect(route.tool).toBe('take_note')
  })

  it('should keep a calendar chip when Claude times out', async () => {
    const route = await routeCapture(
      input({
        chip: 'calendar',
        claude: {
          complete: async () => {
            throw new Error('aborted')
          }
        }
      })
    )
    expect(route.destination).toBe('calendar')
    expect(route.tool).toBe('create_event')
    expect(route.input.start).toMatch(/2026-09-16T10:00:00/)
  })

  it('should use Claude reminder routing when the stub returns reminder JSON', async () => {
    const complete = vi.fn(async () => ({
      text: JSON.stringify({
        destination: 'reminder',
        title: 'Call mom',
        due: '2026-09-15T18:00:00.000+03:00'
      })
    }))
    const route = await routeCapture(input({ text: 'call mom at 6', claude: { complete } }))
    expect(complete).toHaveBeenCalledOnce()
    expect(route).toEqual({
      destination: 'reminder',
      tool: 'remind_me',
      input: { title: 'Call mom', due: '2026-09-15T18:00:00.000+03:00' }
    })
  })

  it('should force chip destination over Claude pick', async () => {
    const route = await routeCapture(
      input({
        chip: 'file',
        text: 'meeting notes\nship by Friday',
        claude: {
          complete: async () => ({
            text: JSON.stringify({
              destination: 'note',
              title: 'meeting notes',
              body: 'ship by Friday'
            })
          })
        }
      })
    )
    expect(route.destination).toBe('file')
    expect(route.tool).toBe('save_to_inbox')
    expect(route.input).toEqual({ title: 'meeting notes', body: 'ship by Friday' })
  })

  it('should reject empty dumps', async () => {
    await expect(routeCapture(input({ text: '   ' }))).rejects.toThrow('Nothing to capture')
  })
})
