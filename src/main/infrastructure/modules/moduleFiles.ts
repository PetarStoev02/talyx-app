import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const BUNDLE_FILE = 'bundle.json'
const SIGNATURE_FILE = 'bundle.sig'

/** A module's files as they sit on disk, not yet checked. */
export interface InstalledFiles {
  bytes: Buffer
  signature: string
}

export class ModuleFilesError extends Error {
  override name = 'ModuleFilesError'
}

/**
 * The installed module in `dir`, or null when it is not installed. A folder with its bundle but
 * an unreadable or missing signature is damaged, not absent: that throws, so it shows as failed.
 */
export async function readInstalled(dir: string): Promise<InstalledFiles | null> {
  await restoreInterruptedSwap(dir)
  let bytes: Buffer
  try {
    bytes = await readFile(join(dir, BUNDLE_FILE))
  } catch (error) {
    if (isMissing(error)) return null
    throw new ModuleFilesError(`The installed module cannot be read (${errorCode(error)}).`)
  }
  try {
    return { bytes, signature: await readFile(join(dir, SIGNATURE_FILE), 'utf8') }
  } catch (error) {
    throw new ModuleFilesError(`The installed module is incomplete (${errorCode(error)}).`)
  }
}

/** Writes a downloaded module next to `dir`, ready for `swapIn`. */
export async function stage(dir: string, files: InstalledFiles): Promise<void> {
  const staging = stagingDir(dir)
  await rm(staging, { recursive: true, force: true })
  await mkdir(staging, { recursive: true })
  await writeFile(join(staging, BUNDLE_FILE), files.bytes)
  await writeFile(join(staging, SIGNATURE_FILE), files.signature)
}

/**
 * Puts the staged module in place of the installed one. The old folder is moved aside first and
 * moved back if the swap fails; a crash between the two renames leaves it aside, and the next
 * `readInstalled` puts it back. Either way the previous version survives a failed update.
 */
export async function swapIn(dir: string): Promise<void> {
  const previous = previousDir(dir)
  await rm(previous, { recursive: true, force: true })
  await rename(dir, previous).catch((error: unknown) => {
    if (!isMissing(error)) throw error
  })
  try {
    await rename(stagingDir(dir), dir)
  } catch (error) {
    await restoreInterruptedSwap(dir)
    throw error
  }
  await rm(previous, { recursive: true, force: true })
}

export async function remove(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true })
  await rm(previousDir(dir), { recursive: true, force: true })
}

async function restoreInterruptedSwap(dir: string): Promise<void> {
  try {
    await rename(previousDir(dir), dir)
  } catch (error) {
    // Nothing aside (the usual case), or `dir` is already there and the aside copy is stale.
    if (!isMissing(error) && errorCode(error) !== 'ENOTEMPTY' && errorCode(error) !== 'EEXIST')
      throw error
  }
}

function stagingDir(dir: string): string {
  return `${dir}.tmp`
}

function previousDir(dir: string): string {
  return `${dir}.old`
}

function isMissing(error: unknown): boolean {
  return errorCode(error) === 'ENOENT'
}

function errorCode(error: unknown): string {
  return (error as NodeJS.ErrnoException | null)?.code ?? 'unknown error'
}
