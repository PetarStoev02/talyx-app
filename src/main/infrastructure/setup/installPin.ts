import { createHash } from 'node:crypto'

// SHA-256 of the engine install file attached to the release. Talyx refuses any other bytes, so a
// hijacked release asset cannot make the app run commands the author did not approve.
// prettier-ignore
export const ENGINE_INSTALL_SHA256 = 'e6abf7a3eff1bcfaae44e0b1636d6dae334277fc903e6632a50d5dc8ebc451fb'

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}
