import { unlink, rename, mkdir, stat } from 'fs/promises'
import type { Stats } from 'fs'
import { dirname } from 'path'
import type { SortHistoryRepo } from '../repository/SortHistoryRepo'
import type { SortOperation } from '../model/SortOperation'
import type { Result } from '../../shared/Result'
import { ok, err } from '../../shared/Result'

export interface UndoOutcome {
  reversed: number
  /** One line per file left as it is, with the reason. */
  failed: string[]
}

export class UndoService {
  constructor(private historyRepo: SortHistoryRepo) {}

  async undoBatch(batchId: string): Promise<Result<UndoOutcome, string>> {
    const operations = this.historyRepo.getBatchOperations(batchId)

    if (operations.length === 0) {
      return err(`No operations found for batch ${batchId}`)
    }
    if (this.historyRepo.isUndone(batchId)) {
      return err(`Batch ${batchId} was already undone`)
    }

    let reversed = 0
    const failed: string[] = []

    // Reverse in LIFO order
    for (const op of [...operations].reverse()) {
      let problem: string | null
      try {
        problem = op.operationType === 'copy' ? await removeCopy(op) : await moveBack(op)
      } catch (e) {
        problem = e instanceof Error ? e.message : String(e)
      }
      if (problem === null) reversed++
      else failed.push(`${op.fileName}: ${problem}`)
    }

    // Keep the batch as an audit trail — History shows it with an "Undone" badge
    this.historyRepo.markUndone(batchId)

    return ok({ reversed, failed })
  }
}

/** The copy goes only while the original is still there and the copy is unchanged in size. */
async function removeCopy(op: SortOperation): Promise<string | null> {
  const [copy, original] = await Promise.all([statOrNull(op.destPath), statOrNull(op.sourcePath)])
  if (copy === null) return 'the copy is no longer there'
  if (original === null) return 'the original is gone, so the copy was kept'
  if (copy.size !== original.size) return 'the copy was changed, so it was kept'
  await unlink(op.destPath)
  return null
}

/** Moves the file back unless something else now sits at its original path. */
async function moveBack(op: SortOperation): Promise<string | null> {
  if ((await statOrNull(op.destPath)) === null)
    return 'the file is no longer where it was sorted to'
  if ((await statOrNull(op.sourcePath)) !== null)
    return 'another file now sits at its original location'
  // The sort may have removed the now-empty source folder — recreate it
  await mkdir(dirname(op.sourcePath), { recursive: true })
  await rename(op.destPath, op.sourcePath)
  return null
}

async function statOrNull(path: string): Promise<Stats | null> {
  try {
    return await stat(path)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw e
  }
}
