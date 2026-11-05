import { createHash } from 'node:crypto'

// SHA-256 of the engine install file attached to the release. Talyx refuses any other bytes, so a
// hijacked release asset cannot make the app run commands the author did not approve.
// prettier-ignore
export const ENGINE_INSTALL_SHA256 = 'e890a903751ee917b6da164f64c18f51b1bae3d77722e90b0b62b8e5e2a02312'

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}
