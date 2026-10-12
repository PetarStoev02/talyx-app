import { copyFile, mkdir, rename } from 'fs/promises'
import { constants, existsSync } from 'fs'
import { dirname } from 'path'
import type { FilePayload } from '../../domain/instruction/capabilities/files'
import { TargetExistsError } from '../../domain/agent/errors'

/**
 * Refuses rather than resolves a name clash: rename/copyFile overwrite silently,
 * and a file the user never approved losing is not a file we can put back.
 * `trash` is injected so this stays testable without electron's shell.
 */
export async function applyFilePayload(
  payload: FilePayload,
  trash: (path: string) => Promise<void>
): Promise<void> {
  if (payload.kind === 'trash') {
    await trash(payload.sourcePath)
    return
  }
  if (existsSync(payload.targetPath)) throw new TargetExistsError(payload.targetPath)
  await mkdir(dirname(payload.targetPath), { recursive: true })
  if (payload.kind === 'copy')
    await copyFile(payload.sourcePath, payload.targetPath, constants.COPYFILE_EXCL)
  else await rename(payload.sourcePath, payload.targetPath)
}
