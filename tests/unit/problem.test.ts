import { describe, expect, it } from 'vitest'
import { AppError, problemOf, problemText } from '../../src/renderer/src/shared/lib/problem'
import { t } from '../../src/renderer/src/shared/lib/i18n'

describe('problems', () => {
  it('should keep the key and detail of an error that names its own message', () => {
    expect(problemOf(new AppError('roster.errorFolderGone', 'id 7'))).toEqual({
      key: 'roster.errorFolderGone',
      detail: 'id 7'
    })
  })

  it.each([
    'Engine gateway is not connected',
    'fetch failed',
    'connect ECONNREFUSED 127.0.0.1:8642',
    'The operation timed out',
    'TimeoutError: signal timed out'
  ])('should call "%s" the engine being out of reach', (message) => {
    expect(problemOf(new Error(message))).toEqual({
      key: 'error.engineUnreachable',
      detail: message
    })
  })

  it.each([
    ['an error of Talyx’s own', new Error('Canvas 2D is unavailable'), 'Canvas 2D is unavailable'],
    ['a thrown string', 'broken', 'broken'],
    ['nothing at all', undefined, null]
  ])('should call %s unexpected and keep its text as the detail', (_case, error, detail) => {
    expect(problemOf(error)).toEqual({ key: 'error.unexpected', detail })
  })

  it('should write a problem as its headline followed by its detail', () => {
    const english = (key: Parameters<typeof t>[0]): string => t(key, 'en')
    expect(problemText(english, { key: 'roster.errorFolderGone', detail: null })).toBe(
      english('roster.errorFolderGone')
    )
    expect(problemText(english, { key: 'error.unexpected', detail: 'boom' })).toBe(
      `${english('error.unexpected')} boom`
    )
  })
})
