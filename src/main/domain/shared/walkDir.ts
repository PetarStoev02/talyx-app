import { readdir, lstat } from 'fs/promises'
import { join, extname } from 'path'
import type { FileEntry } from './FileEntry'

export function isHiddenOrTemp(name: string): boolean {
  return name.startsWith('.') || name.startsWith('~$')
}

const SKIP_DIR_EXTENSIONS = new Set(['.app', '.framework', '.bundle', '.plugin', '.kext'])
const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '__pycache__',
  'Library',
  'Applications',
  'System',
  'bin',
  'sbin',
  'usr',
  'var',
  'tmp',
  'private',
  'Volumes',
  'cores',
  'opt',
  'dev',
  'etc',
  'Trash',
  'AppData',
  'Program Files',
  'Program Files (x86)',
  'Windows',
  'ProgramData',
  '$Recycle.Bin',
  'Recovery'
])

/** Extensions that indicate program/game artifacts — not user-created content */
const PROGRAM_ARTIFACT_EXTENSIONS = new Set([
  '.dll',
  '.so',
  '.dylib',
  '.pdb',
  '.lib',
  '.sys',
  '.drv',
  '.ocx',
  '.winmd',
  '.mpq',
  '.pak',
  '.uasset',
  '.umap',
  '.upk',
  '.unity3d',
  '.assets',
  '.rne',
  '.tps',
  '.wtf',
  '.cur'
])

/**
 * Check if a directory looks like an extracted program/game folder
 * by peeking at the immediate children. If enough files are program
 * artifacts, skip the entire directory.
 */
async function isProgramDirectory(dirPath: string): Promise<boolean> {
  let children: string[]
  try {
    children = await readdir(dirPath)
  } catch {
    return false
  }

  let total = 0
  let artifactCount = 0

  for (const child of children) {
    if (isHiddenOrTemp(child)) continue
    const ext = extname(child).toLowerCase()
    if (!ext) continue
    total++
    if (PROGRAM_ARTIFACT_EXTENSIONS.has(ext)) artifactCount++
  }

  // Skip if 3+ artifact files or >40% of files are artifacts
  return artifactCount >= 3 || (total >= 5 && artifactCount / total > 0.4)
}

export function shouldSkipDir(name: string): boolean {
  if (SKIP_DIR_NAMES.has(name)) return true
  const ext = extname(name).toLowerCase()
  return SKIP_DIR_EXTENSIONS.has(ext)
}

export async function walkDir(dir: string): Promise<FileEntry[]> {
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return [] // Permission denied or inaccessible
  }

  const files: FileEntry[] = []

  for (const name of entries) {
    if (isHiddenOrTemp(name)) continue

    const filePath = join(dir, name)
    try {
      // lstat: a symlink is neither file nor folder here, so it is skipped, never
      // followed — it could point outside the folder (to ~/.aws) or back at itself.
      const fileStat = await lstat(filePath)

      if (fileStat.isDirectory()) {
        if (shouldSkipDir(name)) continue
        if (await isProgramDirectory(filePath)) continue
        files.push(...(await walkDir(filePath)))
      } else if (fileStat.isFile()) {
        files.push({
          name,
          path: filePath,
          extension: extname(name).toLowerCase(),
          size: fileStat.size,
          modifiedAt: fileStat.mtime
        })
      }
    } catch {
      // Skip files we can't access (permission denied, broken symlinks)
    }
  }

  return files
}
