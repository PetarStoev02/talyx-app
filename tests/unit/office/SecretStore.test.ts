import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SecretStore } from '../../../src/main/infrastructure/office/SecretStore'

const fake = {
  encrypt: (s: string): Buffer => Buffer.from(s.split('').reverse().join('')),
  decrypt: (b: Buffer): string => b.toString().split('').reverse().join('')
}

describe('SecretStore', () => {
  let dir: string
  let store: SecretStore
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'secrets-'))
    store = new SecretStore(dir, fake)
  })

  it('should return null when missing', () => {
    expect(store.get('inbound-token')).toBeNull()
  })

  it('should round-trip, encrypted on disk with private modes', () => {
    store.set('webhook-key:b/1', 'v')
    expect(store.get('webhook-key:b/1')).toBe('v')
    expect(statSync(join(dir, 'secrets')).mode & 0o777).toBe(0o700)
    expect(statSync(join(dir, 'secrets', 'webhook-key%3Ab%2F1.bin')).mode & 0o777).toBe(0o600)
  })

  it('should delete, tolerating a missing secret', () => {
    store.set('x', 'v')
    store.delete('x')
    store.delete('x')
    expect(store.get('x')).toBeNull()
  })
})
