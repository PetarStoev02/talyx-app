import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import log from 'electron-log'
import { z } from 'zod'
import type { InstallSteps } from '../../../shared/setup'

// SHA-256 of the engine install file attached to the release. Talyx refuses any other bytes, so a
// hijacked release asset cannot make the app run commands the author did not approve.
// prettier-ignore
export const ENGINE_INSTALL_SHA256 = 'e6abf7a3eff1bcfaae44e0b1636d6dae334277fc903e6632a50d5dc8ebc451fb'

const RELEASES = 'https://github.com/PetarStoev02/talyx-app/releases'
const INSTALL_FILE = 'engine-install.json'
const REQUEST_TIMEOUT_MS = 10_000
const MAX_FILE_BYTES = 64 * 1024

const PlatformSchema = z.object({ commands: z.array(z.string().min(1).max(4096)).min(1).max(20) })
const InstallFileSchema = z.object({
  schema: z.literal(1),
  engineVersion: z.string(),
  platforms: z.object({ darwin: PlatformSchema.optional(), linux: PlatformSchema.optional() })
})

export interface InstallStepsSource {
  /** The file's bytes: fetched from the release in packaged builds, read from disk in dev. */
  read: () => Promise<Uint8Array>
  expectedSha256: string
  platform: NodeJS.Platform
  releaseUrl: string
}

export async function loadInstallSteps(source: InstallStepsSource): Promise<InstallSteps> {
  const { releaseUrl, platform } = source
  if (platform !== 'darwin' && platform !== 'linux') return { kind: 'unsupported', releaseUrl }

  let bytes: Uint8Array
  try {
    bytes = await source.read()
  } catch {
    return { kind: 'unavailable', releaseUrl }
  }

  if (createHash('sha256').update(bytes).digest('hex') !== source.expectedSha256) {
    log.warn('[Setup] Install file hash mismatch')
    return { kind: 'mismatch', releaseUrl }
  }

  const file = parseInstallFile(bytes)
  const steps = file?.platforms[platform]
  if (!file || !steps) return { kind: 'invalid', releaseUrl }
  return { kind: 'ready', commands: steps.commands, engineVersion: file.engineVersion, releaseUrl }
}

function parseInstallFile(bytes: Uint8Array): z.infer<typeof InstallFileSchema> | null {
  try {
    const parsed = InstallFileSchema.safeParse(JSON.parse(new TextDecoder().decode(bytes)))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export function installStepsSource(): InstallStepsSource {
  const tag = `v${app.getVersion()}`
  return {
    read: app.isPackaged
      ? () => fetchFromRelease(`${RELEASES}/download/${tag}/${INSTALL_FILE}`)
      : () => readFile(join(app.getAppPath(), INSTALL_FILE)),
    expectedSha256: ENGINE_INSTALL_SHA256,
    platform: process.platform,
    releaseUrl: `${RELEASES}/tag/${tag}`
  }
}

async function fetchFromRelease(url: string): Promise<Uint8Array> {
  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
  if (!response.ok) throw new Error(`Install file request failed (${response.status})`)
  const body = new Uint8Array(await response.arrayBuffer())
  if (body.length > MAX_FILE_BYTES) throw new Error('Install file is too large')
  return body
}
