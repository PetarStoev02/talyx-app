import { describe, expect, it } from 'vitest'
import {
  LicenseError,
  ModuleBundleError,
  readBundle,
  readLicense
} from '../../../src/main/infrastructure/modules/signing'
import { LICENSE, helloBundle, issueKey, newSigner, signBundle } from './moduleKit'

const signer = newSigner()
const NOW = Date.parse('2026-11-08T12:00:00Z')

describe('readLicense', () => {
  it('should read who the key is for and what it unlocks', () => {
    expect(readLicense(issueKey(signer), signer.keys, NOW)).toEqual({
      id: 'k_test',
      name: 'Ada',
      modules: ['hello'],
      expires: null
    })
  })

  it('should accept a key pasted with spaces around it', () => {
    expect(readLicense(`  ${issueKey(signer)}\n`, signer.keys, NOW).id).toBe('k_test')
  })

  it.each([
    ['signed with another key', issueKey(newSigner())],
    ['with its payload changed', tamper(issueKey(signer))],
    ['without the prefix', issueKey(signer).slice('TALYX-'.length)],
    ['without a signature', issueKey(signer).split('.')[0]],
    ['that is not a key at all', 'hello'],
    ['with an unknown format version', issueKey(signer, { ...LICENSE, v: 2 })],
    ['naming an invalid module id', issueKey(signer, { ...LICENSE, modules: ['../x'] })]
  ])('should refuse a key %s', (_case, key) => {
    expect(() => readLicense(key, signer.keys, NOW)).toThrow(
      new LicenseError('This key is not valid.')
    )
  })

  it('should still accept a key on its last day', () => {
    const key = issueKey(signer, { ...LICENSE, expires: '2026-11-08' })
    expect(readLicense(key, signer.keys, NOW).expires).toBe('2026-11-08')
  })

  it('should refuse a key after its last day', () => {
    const key = issueKey(signer, { ...LICENSE, expires: '2026-11-07' })
    expect(() => readLicense(key, signer.keys, NOW)).toThrow(
      new LicenseError('This key has expired.')
    )
  })
})

describe('readBundle', () => {
  it('should read a module the module key signed', () => {
    const { bytes, signature } = signBundle(signer, helloBundle())
    expect(readBundle(bytes, signature, signer.keys)).toMatchObject({
      id: 'hello',
      version: '1.0.0'
    })
  })

  it('should refuse a module whose bytes changed after signing', () => {
    const { bytes, signature } = signBundle(signer, helloBundle())
    const changed = Buffer.from(bytes.toString().replace('Hello', 'Evil!'))
    expect(() => readBundle(changed, signature, signer.keys)).toThrow(ModuleBundleError)
  })

  it('should refuse a module signed with the license key instead of the module key', () => {
    const swapped = { ...signer, modulePrivate: signer.licensePrivate }
    const { bytes, signature } = signBundle(swapped, helloBundle())
    expect(() => readBundle(bytes, signature, signer.keys)).toThrow(
      new ModuleBundleError('The module is not signed by Talyx.')
    )
  })

  it('should refuse a signed module without a page', () => {
    const { bytes, signature } = signBundle(signer, helloBundle({ files: { 'main.js': '' } }))
    expect(() => readBundle(bytes, signature, signer.keys)).toThrow(
      new ModuleBundleError('The module file is damaged.')
    )
  })
})

/** The same key with one more module written into its payload, signature unchanged. */
function tamper(key: string): string {
  const [payload, signature] = key.slice('TALYX-'.length).split('.')
  const changed = { ...JSON.parse(Buffer.from(payload!, 'base64url').toString()), modules: ['x'] }
  return `TALYX-${Buffer.from(JSON.stringify(changed)).toString('base64url')}.${signature}`
}
