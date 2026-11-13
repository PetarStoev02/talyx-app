/** Splits dropped or pasted files into the images a message can carry and the rest, which it can't. */
export function sortAttachments(files: Iterable<File>): { images: File[]; refused: File[] } {
  const images: File[] = []
  const refused: File[] = []
  for (const file of files) (file.type.startsWith('image/') ? images : refused).push(file)
  return { images, refused }
}

/** A drag of files, not of selected text or a link, which the text field takes as it always has. */
export function carriesFiles(types: readonly string[]): boolean {
  return types.includes('Files')
}
