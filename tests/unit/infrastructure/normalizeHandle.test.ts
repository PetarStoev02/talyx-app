import { describe, it, expect } from 'vitest'
import { normalizeHandle } from '../../../src/main/infrastructure/agent/messagesDeps'

describe('normalizeHandle', () => {
  it.each([
    ['+359 888 123-456', '+359888123456'],
    ['(0888) 123 456', '0888123456'],
    ['  +359888123456  ', '+359888123456']
  ])('should strip how people write the phone number %s', (written, sent) => {
    expect(normalizeHandle(written)).toBe(sent)
  })

  it.each([
    ['john.doe@example.com', 'john.doe@example.com'],
    ['  maria.ivanova@work.example  ', 'maria.ivanova@work.example'],
    ["o'neill.pat@example.co.uk", "o'neill.pat@example.co.uk"]
  ])('should leave the email address %s exactly as it is', (written, sent) => {
    expect(normalizeHandle(written)).toBe(sent)
  })

  it('should send to whatever the approval card showed', () => {
    const handle = 'john.doe@example.com'
    expect(normalizeHandle(handle)).toBe(handle)
  })
})
