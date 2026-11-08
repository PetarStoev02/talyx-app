import { createPublicKey, verify, type KeyObject } from 'node:crypto'
import { z } from 'zod/v4'
import type { LicenseSummary } from '../../../shared/modules'

/**
 * Two keypairs guard two different things. The license key says "may use these modules"; its
 * private half may one day sit on a server that issues keys. The module key says "this code is
 * Talyx's"; its private half never leaves the machine that builds modules, because whatever it
 * signs runs inside Talyx. Only the public halves (Ed25519, JWK `x`) are here.
 */
export interface SigningKeys {
  license: KeyObject
  module: KeyObject
}

export const PUBLISHED_KEYS: SigningKeys = {
  license: publicKey('YCPDZ5kqQBVo5L4s2qBHnnMPe1r9_09sgoHd4aDCgTQ'),
  module: publicKey('viFrA28V2oJYYkVJjUtOmMkpZOaK3ZhKOv22Vn6d934')
}

export function publicKey(x: string): KeyObject {
  return createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x }, format: 'jwk' })
}

export class LicenseError extends Error {
  override name = 'LicenseError'
}

export class ModuleBundleError extends Error {
  override name = 'ModuleBundleError'
}

const LICENSE_PREFIX = 'TALYX-'

export const ModuleIdSchema = z.string().regex(/^[a-z][a-z0-9-]{0,39}$/)

const LicensePayloadSchema = z.object({
  v: z.literal(1),
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  modules: z.array(ModuleIdSchema).max(50),
  expires: z.iso.date().nullable()
})

/**
 * The license a key carries, checked offline against the license public key.
 * A key is `TALYX-<base64url(payload JSON)>.<base64url(signature over those JSON bytes)>`.
 */
export function readLicense(key: string, keys: SigningKeys, now: number): LicenseSummary {
  const trimmed = key.trim()
  const [payload, signature] = trimmed.slice(LICENSE_PREFIX.length).split('.')
  if (!trimmed.startsWith(LICENSE_PREFIX) || !payload || !signature)
    throw new LicenseError('This key is not valid.')
  const bytes = Buffer.from(payload, 'base64url')
  if (!verify(null, bytes, keys.license, Buffer.from(signature, 'base64url')))
    throw new LicenseError('This key is not valid.')
  const parsed = LicensePayloadSchema.safeParse(parseJson(bytes))
  if (!parsed.success) throw new LicenseError('This key is not valid.')
  const { id, name, modules, expires } = parsed.data
  // The whole day of `expires` still counts.
  if (expires !== null && now >= Date.parse(expires) + DAY_MS)
    throw new LicenseError('This key has expired.')
  return { id, name, modules, expires }
}

const DAY_MS = 24 * 60 * 60_000

const ModuleBundleSchema = z.object({
  id: ModuleIdSchema,
  name: z.string().min(1).max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
  apiVersion: z.number().int().positive(),
  files: z.object({
    'renderer.js': z.string(),
    'main.js': z.string().optional(),
    'style.css': z.string().optional()
  })
})

/** A module as one signed JSON file: its manifest and the text of each of its files. */
export type ModuleBundle = z.infer<typeof ModuleBundleSchema>

/** The module a bundle holds, refused unless the module key signed exactly these bytes. */
export function readBundle(bytes: Buffer, signature: string, keys: SigningKeys): ModuleBundle {
  if (!verify(null, bytes, keys.module, Buffer.from(signature.trim(), 'base64url')))
    throw new ModuleBundleError('The module is not signed by Talyx.')
  const parsed = ModuleBundleSchema.safeParse(parseJson(bytes))
  if (!parsed.success) throw new ModuleBundleError('The module file is damaged.')
  return parsed.data
}

function parseJson(bytes: Buffer): unknown {
  try {
    return JSON.parse(bytes.toString('utf8'))
  } catch {
    // Unparseable reads as "no valid payload"; the schema check then names the failure.
    return null
  }
}
