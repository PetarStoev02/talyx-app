const MAX_SPOKEN_CHARS = 600

/** Crude on purpose: the only failure that matters is a synthesiser reading "**" aloud. */
export function markdownToSpeech(markdown: string): string {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    // Emphasis (*, _) and strikethrough (~~) markers only — a lone "~" is a path (~/Code), not markdown.
    .replace(/\*{1,3}|_{1,3}|~~/g, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/\s+/g, ' ')
    .trim()

  return plain.length > MAX_SPOKEN_CHARS
    ? `${plain.slice(0, MAX_SPOKEN_CHARS - 1).trimEnd()}…`
    : plain
}
