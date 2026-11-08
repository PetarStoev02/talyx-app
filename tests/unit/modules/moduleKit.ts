import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto'
import type { SigningKeys } from '../../../src/main/infrastructure/modules/signing'
import { MODULE_API_VERSION } from '../../../src/shared/modules'

/** Throwaway keypairs standing in for Talyx's license and module keys. */
export interface TestSigner {
  keys: SigningKeys
  licensePrivate: KeyObject
  modulePrivate: KeyObject
}

export function newSigner(): TestSigner {
  const license = generateKeyPairSync('ed25519')
  const module = generateKeyPairSync('ed25519')
  return {
    keys: { license: license.publicKey, module: module.publicKey },
    licensePrivate: license.privateKey,
    modulePrivate: module.privateKey
  }
}

export const LICENSE = {
  v: 1,
  id: 'k_test',
  name: 'Ada',
  modules: ['hello'],
  expires: null as string | null
}

export function issueKey(signer: TestSigner, payload: object = LICENSE): string {
  const bytes = Buffer.from(JSON.stringify(payload))
  const signature = sign(null, bytes, signer.licensePrivate)
  return `TALYX-${bytes.toString('base64url')}.${signature.toString('base64url')}`
}

export const HELLO_MAIN = `
const { join } = require('node:path')
module.exports = {
  activate(ctx) {
    ctx.handle('greet', (input) => 'hello ' + input.name + ' from ' + join('a', 'b'))
  },
  deactivate() {
    globalThis.helloStopped = (globalThis.helloStopped ?? 0) + 1
  }
}
`

export function helloBundle(overrides: object = {}): object {
  return {
    id: 'hello',
    name: 'Hello',
    version: '1.0.0',
    apiVersion: MODULE_API_VERSION,
    files: { 'renderer.js': 'export default function Hello() {}', 'main.js': HELLO_MAIN },
    ...overrides
  }
}

export function signBundle(
  signer: TestSigner,
  bundle: object
): { bytes: Buffer; signature: string } {
  const bytes = Buffer.from(JSON.stringify(bundle))
  return { bytes, signature: sign(null, bytes, signer.modulePrivate).toString('base64url') }
}
