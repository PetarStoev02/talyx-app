import { describe, it, expect } from 'vitest'
import { buildSystemPrompt, localNow } from '../../../src/main/infrastructure/agent/systemPrompt'

function prompt(overrides: Partial<Parameters<typeof buildSystemPrompt>[0]> = {}): string {
  return buildSystemPrompt({
    home: '/Users/test',
    projectsRoot: null,
    platform: 'darwin',
    now: '2026-09-19T09:24+03:00',
    ...overrides
  })
}

describe('buildSystemPrompt', () => {
  it('should carry the wall clock, not just the date, so a relative time needs no shell', () => {
    expect(prompt()).toContain('2026-09-19T09:24+03:00')
  })

  it('should tell the model to work relative times out from that clock', () => {
    expect(prompt().toLowerCase()).toContain('work out')
  })

  it('should offer the developer rule only to an owner who has a projects folder', () => {
    expect(prompt({ projectsRoot: '/Users/test/Code' })).toContain('list_repos')
    expect(prompt()).not.toContain('list_repos')
  })

  it('should name the home folder and the platform', () => {
    const text = prompt()
    expect(text).toContain('/Users/test')
    expect(text).toContain('darwin')
  })
})

describe('localNow', () => {
  it('should report the machine time in its own offset, not UTC', () => {
    process.env.TZ = 'Europe/Sofia'
    expect(localNow(new Date('2026-09-19T06:24:05.000Z'))).toBe('2026-09-19T09:24+03:00')
  })

  it('should leave the seconds out, so the cached prompt prefix survives a minute', () => {
    process.env.TZ = 'Europe/Sofia'
    expect(localNow(new Date('2026-09-19T06:24:05.000Z'))).toBe(
      localNow(new Date('2026-09-19T06:24:59.000Z'))
    )
  })

  it('should pad every field to two digits', () => {
    process.env.TZ = 'Europe/Sofia'
    expect(localNow(new Date('2026-01-05T05:04:03.000Z'))).toBe('2026-01-05T07:04+02:00')
  })
})
