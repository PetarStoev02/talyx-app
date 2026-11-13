/** Splits dropped or pasted files into the images a message can carry and the rest, which it can't. */
export function sortAttachments(files: Iterable<File>): { images: File[]; refused: File[] } {
  const images: File[] = []
  const refused: File[] = []
  for (const file of files) (file.type.startsWith('image/') ? images : refused).push(file)
  return { images, refused }
}
