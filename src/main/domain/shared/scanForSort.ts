import { readdir, lstat } from 'fs/promises'
import { join, extname } from 'path'
import type { FileEntry } from './FileEntry'
import { isHiddenOrTemp, shouldSkipDir } from './walkDir'

/** Why a subfolder is kept intact instead of being opened for sorting */
export type FolderKind = 'project' | 'app' | 'folder'

export interface SealedFolder {
  name: string
  path: string
  kind: FolderKind
  fileCount: number
}

export interface SortScanResult {
  files: FileEntry[]
  sealedFolders: SealedFolder[]
  /**
   * Files sitting inside plain subfolders, at any depth — what a deeper scan
   * would add. Counted even on a shallow scan so the offer to go deeper can
   * state its size before anyone commits to classifying that many files.
   */
  nestedFileCount: number
}

export interface ScanForSortOptions {
  /**
   * Open plain subfolders as well, at any depth. Projects and apps stay
   * sealed regardless — scattering those is what sealing exists to prevent.
   */
  includeSubfolders?: boolean
}

/**
 * Stops a pathological tree from being walked forever. A plan this large is
 * not one anybody reviews anyway.
 * ponytail: flat cap, make it a setting if someone hits it legitimately.
 */
const MAX_NESTED_FILES = 20_000

/** Files whose presence marks a directory as a software project */
const PROJECT_MARKERS = new Set([
  '.git',
  'package.json',
  'tsconfig.json',
  'pyproject.toml',
  'requirements.txt',
  'Cargo.toml',
  'go.mod',
  'pom.xml',
  'build.gradle',
  'composer.json',
  'Gemfile',
  'Makefile',
  'CMakeLists.txt',
  '.gitignore',
  '.sln'
])

const CODE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.py',
  '.php',
  '.html',
  '.css',
  '.scss',
  '.json',
  '.go',
  '.rs',
  '.java',
  '.c',
  '.cpp',
  '.h',
  '.rb',
  '.sh',
  '.vue',
  '.svelte'
])

const EXECUTABLE_EXTENSIONS = new Set(['.exe', '.msi', '.bat', '.cmd', '.com'])
const LIBRARY_EXTENSIONS = new Set(['.dll', '.so', '.dylib', '.sys', '.ocx'])
const WEB_ASSET_DIRS = new Set(['css', 'js', 'assets', 'img', 'images', 'fonts', 'src'])

/**
 * Classify what a directory IS, from its immediate children:
 * - 'project' — a software/web project whose files belong together
 * - 'app'     — an installed/extracted application (exe + libraries)
 * - 'folder'  — anything else (still sealed during sorting)
 */
export async function detectFolderKind(dirPath: string): Promise<FolderKind> {
  let children: string[]
  try {
    children = await readdir(dirPath)
  } catch {
    return 'folder'
  }

  let fileTotal = 0
  let codeCount = 0
  let libraryCount = 0
  let hasExecutable = false
  let hasIndexHtml = false
  let hasWebAssetDir = false

  for (const child of children) {
    if (PROJECT_MARKERS.has(child)) return 'project'

    const ext = extname(child).toLowerCase()
    if (ext === '.sln' || ext === '.xcodeproj') return 'project'

    if (!ext) {
      if (WEB_ASSET_DIRS.has(child.toLowerCase())) hasWebAssetDir = true
      continue
    }

    fileTotal++
    if (CODE_EXTENSIONS.has(ext)) codeCount++
    if (LIBRARY_EXTENSIONS.has(ext)) libraryCount++
    if (EXECUTABLE_EXTENSIONS.has(ext)) hasExecutable = true
    if (child.toLowerCase() === 'index.html') hasIndexHtml = true
  }

  if (hasExecutable && libraryCount > 0) return 'app'
  if (libraryCount >= 3) return 'app'
  if (hasIndexHtml && hasWebAssetDir) return 'project'
  if (fileTotal >= 3 && codeCount / fileTotal >= 0.6) return 'project'

  return 'folder'
}

/** Everything under a plain folder, with projects and apps left sealed. */
async function collectNested(
  dirPath: string,
  sealed: SealedFolder[],
  files: FileEntry[]
): Promise<void> {
  if (files.length >= MAX_NESTED_FILES) return
  let entries: string[]
  try {
    entries = await readdir(dirPath)
  } catch {
    return
  }

  for (const name of entries) {
    if (isHiddenOrTemp(name)) continue
    const entryPath = join(dirPath, name)
    try {
      // lstat: a symlink is neither file nor folder here, so it is skipped, never
      // followed — it could point outside the folder (to ~/.aws) or back at itself.
      const entryStat = await lstat(entryPath)
      if (entryStat.isDirectory()) {
        if (shouldSkipDir(name)) continue
        const kind = await detectFolderKind(entryPath)
        if (kind === 'folder') {
          await collectNested(entryPath, sealed, files)
        } else {
          sealed.push({ name, path: entryPath, kind, fileCount: await countChildren(entryPath) })
        }
      } else if (entryStat.isFile()) {
        if (files.length >= MAX_NESTED_FILES) return
        files.push({
          name,
          path: entryPath,
          extension: extname(name).toLowerCase(),
          size: entryStat.size,
          modifiedAt: entryStat.mtime
        })
      }
    } catch {
      // Skip entries we can't access
    }
  }
}

async function countChildren(dirPath: string): Promise<number> {
  try {
    return (await readdir(dirPath)).filter((c) => !isHiddenOrTemp(c)).length
  } catch {
    return 0
  }
}

/**
 * Scan a folder for sorting. By default only loose files at the root are
 * candidates and every subfolder is sealed — reported but never opened — so
 * cohesive folders can't be scattered. With `includeSubfolders`, plain folders
 * are opened at any depth; projects and apps stay sealed either way.
 */
export async function scanForSort(
  folderPath: string,
  options?: ScanForSortOptions
): Promise<SortScanResult> {
  let entries: string[]
  try {
    entries = await readdir(folderPath)
  } catch {
    return { files: [], sealedFolders: [], nestedFileCount: 0 }
  }

  const files: FileEntry[] = []
  const sealedFolders: SealedFolder[] = []
  const nested: FileEntry[] = []
  // A project buried three levels down is only worth reporting when the scan
  // actually went down there; on a shallow scan it would be noise.
  const nestedSealed: SealedFolder[] = []

  for (const name of entries) {
    if (isHiddenOrTemp(name)) continue

    const entryPath = join(folderPath, name)
    try {
      const entryStat = await lstat(entryPath)

      if (entryStat.isDirectory()) {
        if (shouldSkipDir(name)) continue
        const kind = await detectFolderKind(entryPath)
        if (kind === 'folder') {
          // Walked either way: opened when asked for, counted otherwise so the
          // offer to go deeper can say how much work it would be.
          await collectNested(entryPath, nestedSealed, nested)
          if (!options?.includeSubfolders) {
            sealedFolders.push({
              name,
              path: entryPath,
              kind,
              fileCount: await countChildren(entryPath)
            })
          }
          continue
        }
        sealedFolders.push({
          name,
          path: entryPath,
          kind,
          fileCount: await countChildren(entryPath)
        })
      } else if (entryStat.isFile()) {
        files.push({
          name,
          path: entryPath,
          extension: extname(name).toLowerCase(),
          size: entryStat.size,
          modifiedAt: entryStat.mtime
        })
      }
    } catch {
      // Skip entries we can't access
    }
  }

  if (options?.includeSubfolders) {
    files.push(...nested)
    sealedFolders.push(...nestedSealed)
    return { files, sealedFolders, nestedFileCount: 0 }
  }
  return { files, sealedFolders, nestedFileCount: nested.length }
}
