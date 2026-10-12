import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({ app: {}, session: {}, shell: {} }))

import {
  isAllowedPermission,
  isAppUrl,
  isSafeExternalUrl
} from '../../../src/main/infrastructure/security/webContentsGuard'

const PACKAGED = 'file:///Applications/Talyx.app/Contents/Resources/app.asar/out/renderer/'
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
    [`${PACKAGED}assistant.html#x`, PACKAGED, true],
    ['file:///Users/v/Downloads/evil.html', PACKAGED, false],
    [`${DEV}assistant.html`, DEV, true],
    ['http://localhost:51730/', DEV, false],
    ['https://evil.example/', DEV, false]
  ])('should judge %s inside %s as %s', (url, root, expected) => {
    expect(isAppUrl(url, root)).toBe(expected)
  })
})

describe('isAllowedPermission', () => {
  it('should let the app itself use the microphone', () => {
    expect(isAllowedPermission('media', `${PACKAGED}assistant.html`, PACKAGED)).toBe(true)
  })

  it('should refuse the microphone to any other page', () => {
    expect(isAllowedPermission('media', 'https://evil.example/', PACKAGED)).toBe(false)
  })

  it('should refuse permissions the app never needs', () => {
    expect(isAllowedPermission('geolocation', `${PACKAGED}index.html`, PACKAGED)).toBe(false)
  })
})
