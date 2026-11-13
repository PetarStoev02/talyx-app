/**
 * Splits dropped or pasted files: images upload with the message; any other file or folder goes
 * by its path, which the bot (on this computer) opens itself; a file with no path, such as one
 * dragged from a web page, cannot go at all.
 */
export function sortAttachments(
  files: Iterable<File>,
  pathOf: (file: File) => string
): { images: File[]; paths: string[]; refused: File[] } {
  const images: File[] = []
  const paths: string[] = []
  const refused: File[] = []
  for (const file of files) {
    const path = pathOf(file)
    if (file.type.startsWith('image/')) images.push(file)
    else if (path) paths.push(path)
    else refused.push(file)
  }
  return { images, paths, refused }
}

/** The draft with each path on its own line under what was typed. */
export function draftWithPaths(text: string, paths: string[]): string {
  return [...(text.trim() ? [text] : []), ...paths].join('\n')
}

/** The last part of a path: a file's or a folder's own name, for its chip in the composer. */
export function baseName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path
}
