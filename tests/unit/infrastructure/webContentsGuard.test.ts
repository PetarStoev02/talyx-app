import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({ app: {}, session: {}, shell: {} }))

import {
  checkedRequest,
  isAllowedPermission,
  isAppUrl,
  isSafeExternalUrl
} from '../../../src/main/infrastructure/security/webContentsGuard'

const PACKAGED = 'app://talyx/'
const DEV = 'http://localhost:5173/'

describe('isSafeExternalUrl', () => {
  it.each([
    ['https://claude.ai/login', true],
    ['http://example.com', true],
    ['mailto:a@example.com', true],
    ['file:///Users/v/Downloads/x.command', false],
    ['/Users/v/Downloads/x.command', false],
    ['javascript:alert(1)', false],
    ['x-apple.systempreferences:com.apple.preference.security', false],
    ['not a url', false]
  ])('should judge %s as %s', (url, expected) => {
    expect(isSafeExternalUrl(url)).toBe(expected)
  })
})

describe('isAppUrl', () => {
  it.each([
    [`${PACKAGED}index.html`, PACKAGED, true],
    [`${PACKAGED}splash.html#x`, PACKAGED, true],
    ['file:///Users/v/Downloads/evil.html', PACKAGED, false],
    ['app://talyx.evil/index.html', PACKAGED, false],
    [`${DEV}splash.html`, DEV, true],
    ['http://localhost:51730/', DEV, false],
    ['https://evil.example/', DEV, false]
  ])('should judge %s inside %s as %s', (url, root, expected) => {
    expect(isAppUrl(url, root)).toBe(expected)
  })
})

describe('isAllowedPermission', () => {
  it("should allow the microphone for the app's own pages only", () => {
    const app = `${PACKAGED}index.html`
    expect(
      isAllowedPermission('media', { requestingUrl: app, mediaTypes: ['audio'] }, PACKAGED)
    ).toBe(true)
    expect(
      isAllowedPermission('media', { requestingUrl: app, mediaTypes: ['video'] }, PACKAGED)
    ).toBe(false)
    expect(
      isAllowedPermission('media', { requestingUrl: app, mediaTypes: ['audio', 'video'] }, PACKAGED)
    ).toBe(false)
    expect(
      isAllowedPermission(
        'media',
        { requestingUrl: 'https://evil.example/', mediaTypes: ['audio'] },
        PACKAGED
      )
    ).toBe(false)
  })

  it('should allow writing to the clipboard for the Copy buttons', () => {
    expect(
      isAllowedPermission(
        'clipboard-sanitized-write',
        { requestingUrl: `${PACKAGED}index.html` },
        PACKAGED
      )
    ).toBe(true)
  })

  it.each(['clipboard-read', 'notifications'])(
    'should refuse %s while no feature of the app needs it',
    (permission) => {
      expect(
        isAllowedPermission(permission, { requestingUrl: `${PACKAGED}index.html` }, PACKAGED)
      ).toBe(false)
    }
  )

  it('should refuse any permission to a page outside the app', () => {
    expect(isAllowedPermission('media', { requestingUrl: 'https://evil.example/' }, PACKAGED)).toBe(
      false
    )
  })

  it('should refuse permissions the app never needs', () => {
    expect(
      isAllowedPermission('geolocation', { requestingUrl: `${PACKAGED}index.html` }, PACKAGED)
    ).toBe(false)
  })
})

describe('checkedRequest', () => {
  it.each([
    ['audio', true],
    ['unknown', true],
    [undefined, true],
    ['video', false]
  ])('should judge a %s microphone check from the app as %s', (mediaType, expected) => {
    const request = checkedRequest('app://talyx', { mediaType })
    expect(isAllowedPermission('media', request, PACKAGED)).toBe(expected)
  })

  it('should judge a check by its origin when it names no page', () => {
    const request = checkedRequest('https://evil.example', {})
    expect(isAllowedPermission('clipboard-sanitized-write', request, PACKAGED)).toBe(false)
  })
})
