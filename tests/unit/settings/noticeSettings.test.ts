import { describe, it, expect } from 'vitest'
import { UserSettingsPartialSchema } from '../../../src/main/infrastructure/ipc/validation'

describe('notice settings at the IPC boundary', () => {
  it('should accept the switches the settings page sends', () => {
    const parsed = UserSettingsPartialSchema.parse({
      noticesEnabled: true,
      briefingTime: '07:30',
      briefingStyle: 'written',
      noticeKinds: { briefing: true, disk: false, meeting: true, agenda: false, clutter: true }
    })

    expect(parsed.noticesEnabled).toBe(true)
    expect(parsed.briefingTime).toBe('07:30')
    expect(parsed.noticeKinds?.disk).toBe(false)
  })

  it.each(['24:00', '7:30', '08:60', 'morning', ''])(
    'should refuse %s as a briefing time',
    (briefingTime) => {
      expect(() => UserSettingsPartialSchema.parse({ briefingTime })).toThrow()
    }
  )

  it('should let the window record that macOS has been asked', () => {
    const parsed = UserSettingsPartialSchema.parse({ noticesPermissionAsked: true })

    expect(parsed.noticesPermissionAsked).toBe(true)
  })

  it('should never let the window rewrite what Talyx has already said', () => {
    const parsed = UserSettingsPartialSchema.parse({ noticeMarks: { briefing: '1999-01-01' } })

    expect(parsed).not.toHaveProperty('noticeMarks')
  })
})
