import { KEPT_FILE_MAX_BYTES } from '../../../../shared/keptFiles'
import { sendMentions, type Mention } from './mentions'

// ponytail: a path only works while the engine runs on this computer; a remote engine (PR 12)
// needs the file uploaded instead, or paths refused.
/**
 * Splits dropped or pasted files: images upload with the message; any other file or folder goes
 * by its path, which the bot (on this computer) opens itself. A file with no path (a web
 * download, a Mail attachment, any file in the browser dev bridge) goes as a copy Talyx keeps,
 * up to the cap.
 */
export function sortAttachments(
  files: Iterable<File>,
  pathOf: (file: File) => string
): { images: File[]; paths: string[]; copies: File[]; tooBig: File[] } {
  const sorted = {
    images: [] as File[],
    paths: [] as string[],
    copies: [] as File[],
    tooBig: [] as File[]
  }
  for (const file of files) {
    const path = pathOf(file)
    if (file.type.startsWith('image/')) sorted.images.push(file)
    else if (path) sorted.paths.push(path)
    else if (file.size > KEPT_FILE_MAX_BYTES) sorted.tooBig.push(file)
    else sorted.copies.push(file)
  }
  return sorted
}

/** The draft with each path on its own line under what was typed. */
export function draftWithPaths(text: string, paths: string[]): string {
  return [...(text.trim() ? [text] : []), ...paths].join('\n')
}

/**
 * A room message as the engine routes it: typed `@name`s go to handles, and the paths join after,
 * untouched, so a folder named `@Writer` still points where it is on disk.
 */
export function roomText(text: string, paths: string[], mentions: Mention[]): string {
  return draftWithPaths(sendMentions(text, mentions), paths)
}

/** The last part of a path: a file's or a folder's own name, for its chip in the composer. */
export function baseName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path
}
