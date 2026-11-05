const names = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' })

/** Names as a sentence would list them: "A", "A and B", "A, B, and C". */
export function listOf(items: string[]): string {
  return names.format(items)
}
