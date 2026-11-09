import { describe, expect, it } from 'vitest'
import {
  activationRequestFrom,
  activationRequestIn
} from '../../../src/main/infrastructure/modules/activationLink'

describe('activation links', () => {
  it('should carry the key of an activation link into the dialog', () => {
    expect(activationRequestFrom('talyx://activate?key=TALYX-abc.def')).toEqual({
      key: 'TALYX-abc.def'
    })
  })

  it('should open the dialog empty for a link without a key', () => {
    expect(activationRequestFrom('talyx://activate')).toEqual({ key: null })
  })

  it('should drop a key too long to be one', () => {
    expect(activationRequestFrom(`talyx://activate?key=${'a'.repeat(2001)}`)).toEqual({
      key: null
    })
  })

  it.each(['talyx://install?key=x', 'https://activate?key=x', 'not a url'])(
    'should ignore %s',
    (url) => {
      expect(activationRequestFrom(url)).toBeNull()
    }
  )

  it('should find the link among a new instance arguments on Linux', () => {
    const argv = ['/opt/Talyx/talyx', '--no-sandbox', 'talyx://activate?key=k']
    expect(activationRequestIn(argv)).toEqual({ key: 'k' })
    expect(activationRequestIn(['/opt/Talyx/talyx'])).toBeNull()
  })
})
