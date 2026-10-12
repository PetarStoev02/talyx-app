import { z } from 'zod/v4'
import { randomUUID } from 'crypto'
import { basename, dirname, extname, join } from 'path'
import type { Capability, Operation, Proposal } from '../model/Capability'
import type { Effect } from '../model/Effect'
import { resolveFolder } from '../model/resolveFolder'
import type { SortMode } from '../../sorting/model/SortMode'

export interface FileRef {
  name: string
  path: string
  size: number
}

export interface ClassifiedRef extends FileRef {
  category: string
  subcategory: string | null
}

/** Exactly what the file capabilities reach — capabilities, not repositories. */
export interface FileCapabilityDeps {
  /** Loose root files only; subfolders stay sealed, as in a normal sort. */
  scanFolder(folderPath: string): Promise<FileRef[]>
  classify(files: FileRef[]): Promise<ClassifiedRef[]>
  /** Groups of paths with identical content; each group has 2+ entries. */
  findDuplicateGroups(folderPath: string): Promise<string[][]>
  searchFiles(
    query: string,
    limit: number
  ): Promise<{ path: string; name: string; snippet: string }[]>
  /** Applies one payload to the filesystem. */
  apply(payload: FilePayload): Promise<void>
  /** Writes a Sort History row so Ask/overlay sorts show up on the History page. */
  recordSortOperation(op: {
    batchId: string
    sourcePath: string
    destPath: string
    operationType: SortMode
    category: string | null
    subcategory: string | null
    fileName: string
    fileSize: number | null
    createdAt: string
  }): void
  /** Writes `targetPath` in `format` from the image at `sourcePath`; fails if the target exists. */
  convertImage(sourcePath: string, targetPath: string, format: ImageFormat): Promise<void>
}

export type ImageFormat = 'jpg' | 'png' | 'pdf'
export type ConvertPayload = {
  kind: 'convert'
  sourcePath: string
  targetPath: string
  format: ImageFormat
}

/** What the file executor in the IPC layer reads back off an operation. */
export type MovePayload = {
  kind: 'move' | 'copy'
  sourcePath: string
  targetPath: string
  /** When set, execute also writes a Sort History row in this batch. */
  sortBatchId?: string
  category?: string | null
  subcategory?: string | null
  fileSize?: number | null
}
export type TrashPayload = { kind: 'trash'; sourcePath: string }
export type FilePayload = MovePayload | TrashPayload

const REVERSIBLE_MUTATION: Effect = {
  reversible: true,
  world: 'mutates',
  discloses: 'nothing'
}

/**
 * Trashing goes through shell.trashItem, and there is no programmatic way back
 * out of the Trash. Declaring this reversible would put an Undo button on screen
 * that cannot work — the review card warns instead.
 */
const ONE_WAY_MUTATION: Effect = {
  reversible: false,
  world: 'mutates',
  discloses: 'nothing'
}

const READ_ONLY: Effect = { reversible: false, world: 'reads', discloses: 'nothing' }
/** A converted copy is new; trashing it puts things back exactly. */
const REVERSIBLE_CREATE: Effect = { reversible: true, world: 'creates', discloses: 'nothing' }

/**
 * Resolved at the validation boundary, so capabilities only ever see a real
 * absolute path. A spoken name like "downloads" that reached the filesystem
 * unresolved would scan the process directory and report an empty folder —
 * indistinguishable from a typo.
 */
const folderParam = z.object({
  folder: z
    .string()
    .min(1)
    .transform((value, ctx) => {
      try {
        return resolveFolder(value)
      } catch (err) {
        ctx.addIssue({ code: 'custom', message: (err as Error).message })
        return z.NEVER
      }
    })
    .describe('Folder to work on — a full path, or a name like Downloads or Desktop')
})

/**
 * A copy leaves the source untouched, so its inverse cannot be "swap the paths
 * back" — that would overwrite the original with its own copy, or fail outright.
 * The clean, complete inverse of a copy is to trash the copy it created.
 */
function move(
  sourcePath: string,
  targetPath: string,
  mode: 'move' | 'copy',
  reason: string,
  history?: {
    sortBatchId: string
    category: string | null
    subcategory: string | null
    fileSize: number | null
  }
): Operation {
  return {
    label: `${sourcePath} → ${targetPath}`,
    reason,
    payload: {
      kind: mode,
      sourcePath,
      targetPath,
      ...(history
        ? {
            sortBatchId: history.sortBatchId,
            category: history.category,
            subcategory: history.subcategory,
            fileSize: history.fileSize
          }
        : {})
    } satisfies MovePayload,
    inverse:
      mode === 'move'
        ? ({ kind: 'move', sourcePath: targetPath, targetPath: sourcePath } satisfies MovePayload)
        : ({ kind: 'trash', sourcePath: targetPath } satisfies TrashPayload)
  }
}

function plan(summary: string, operations: Operation[]): Proposal {
  return { kind: 'plan', summary, operations }
}

export function fileCapabilities(deps: FileCapabilityDeps): Capability[] {
  const sortFolder: Capability<{ folder: string; mode: 'move' | 'copy' }> = {
    name: 'sort_folder',
    description: 'Organize the loose files in a folder into subfolders by their content',
    examples: ['sort my downloads', 'organize /Users/me/Desktop', 'tidy up this folder'],
    params: folderParam.extend({
      mode: z.enum(['move', 'copy']).default('move').describe('move the files or copy them')
    }),
    effect: REVERSIBLE_MUTATION,
    async plan({ folder, mode }): Promise<Proposal> {
      const files = await deps.scanFolder(folder)
      if (files.length === 0) {
        return plan(`No loose files to organize in ${folder}`, [])
      }

      const classified = await deps.classify(files)
      const sortBatchId = randomUUID()
      const operations = classified.map((file) => {
        const subPath = file.subcategory ? join(file.category, file.subcategory) : file.category
        return move(
          file.path,
          join(folder, subPath, file.name),
          mode,
          subPath.replace(/[\\/]/g, ' / '),
          {
            sortBatchId,
            category: file.category,
            subcategory: file.subcategory,
            fileSize: file.size
          }
        )
      })

      const verb = mode === 'move' ? 'Move' : 'Copy'
      return plan(
        `${verb} ${operations.length} file${operations.length === 1 ? '' : 's'} in ${folder} into folders by content`,
        operations
      )
    },
    async execute(op) {
      const payload = op.payload as FilePayload
      await deps.apply(payload)
      if (payload.kind === 'trash' || !payload.sortBatchId) return
      const createdAt = new Date().toISOString().replace('T', ' ').slice(0, 19)
      deps.recordSortOperation({
        batchId: payload.sortBatchId,
        sourcePath: payload.sourcePath,
        destPath: payload.targetPath,
        operationType: payload.kind,
        category: payload.category ?? null,
        subcategory: payload.subcategory ?? null,
        fileName: basename(payload.targetPath),
        fileSize: payload.fileSize ?? null,
        createdAt
      })
    },
    async revert(op) {
      await deps.apply(op.inverse as FilePayload)
    }
  }

  const findDuplicates: Capability<{ folder: string }> = {
    name: 'find_duplicates',
    description: 'Find files with identical content in a folder and remove the extra copies',
    examples: ['find duplicates in my downloads', 'remove duplicate files from /Users/me/Pictures'],
    params: folderParam,
    effect: ONE_WAY_MUTATION,
    async plan({ folder }): Promise<Proposal> {
      const groups = await deps.findDuplicateGroups(folder)

      // The first file in each group is the keeper — never propose emptying a group
      const operations: Operation[] = groups.flatMap(([keep, ...extras]) =>
        extras.map((path) => ({
          label: path,
          reason: `duplicate of ${keep.split(/[\\/]/).pop()}`,
          payload: { kind: 'trash', sourcePath: path } satisfies TrashPayload,
          inverse: null
        }))
      )

      return plan(
        operations.length === 0
          ? `No duplicate files in ${folder}`
          : `Delete ${operations.length} duplicate file${operations.length === 1 ? '' : 's'} in ${folder}, keeping one copy of each`,
        operations
      )
    },
    async execute(op) {
      await deps.apply(op.payload as FilePayload)
    }
    // No revert: effect.reversible is false, and the registry checks that.
  }

  const searchFiles: Capability<{ query: string; limit: number }> = {
    name: 'search_files',
    description: 'Find files by what is written inside them, and show the matches',
    examples: ['find my invoice from acme', 'which files mention the budget', 'where is my lease'],
    params: z.object({
      query: z.string().min(1).describe('What to look for inside the files'),
      limit: z.number().int().min(1).max(50).default(20)
    }),
    effect: READ_ONLY,
    async plan({ query, limit }): Promise<Proposal> {
      const matches = await deps.searchFiles(query, limit)
      return {
        kind: 'answer',
        summary:
          matches.length === 0
            ? `Nothing matches "${query}"`
            : `${matches.length} file${matches.length === 1 ? '' : 's'} matching "${query}"`,
        evidence: matches.map((m) => ({ text: m.snippet, source: m.path })),
        card: {
          kind: 'paths',
          entries: matches.map((m) => ({
            path: m.path,
            label: m.name,
            snippet: m.snippet,
            isDirectory: false
          }))
        }
      }
    }
  }

  const convertFile: Capability<{ path: string; to: ImageFormat }> = {
    name: 'convert_file',
    description: 'Convert an image (HEIC, PNG, JPG, TIFF) to JPG, PNG or a one-page PDF',
    examples: ['convert this heic to jpg', 'make a pdf out of ~/Desktop/scan.png'],
    params: z.object({
      path: z.string().min(1).describe('Full path of the image, ~ allowed'),
      to: z.enum(['jpg', 'png', 'pdf']).describe('Target format')
    }),
    effect: REVERSIBLE_CREATE,
    async plan({ path, to }, ctx): Promise<Proposal> {
      const sourcePath = path.startsWith('~') ? join(ctx.home, path.slice(1)) : path
      const name = basename(sourcePath)
      const current = extname(sourcePath).slice(1).toLowerCase()
      if (current === to || (current === 'jpeg' && to === 'jpg')) {
        return { kind: 'answer', summary: `${name} is already a ${to.toUpperCase()}`, evidence: [] }
      }
      const targetPath = join(
        dirname(sourcePath),
        `${basename(sourcePath, extname(sourcePath))}.${to}`
      )
      return {
        kind: 'plan',
        summary: `Convert ${name} to ${to.toUpperCase()}`,
        operations: [
          {
            label: `${name} → ${basename(targetPath)}`,
            reason: 'convert',
            payload: { kind: 'convert', sourcePath, targetPath, format: to },
            inverse: { kind: 'trash', sourcePath: targetPath }
          }
        ]
      }
    },
    async execute(op) {
      const { sourcePath, targetPath, format } = op.payload as ConvertPayload
      await deps.convertImage(sourcePath, targetPath, format)
    },
    async revert(op) {
      await deps.apply(op.inverse as TrashPayload)
    }
  }

  return [
    sortFolder as Capability,
    findDuplicates as Capability,
    searchFiles as Capability,
    convertFile as Capability
  ]
}
