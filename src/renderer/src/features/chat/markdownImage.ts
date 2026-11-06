/** How a bot's markdown image shows: inline data images only, so a remote image (a tracking
 *  pixel) never loads; a web address becomes a link the user can choose to open. */
export type MarkdownImage =
  | { kind: 'image'; src: string }
  | { kind: 'link'; href: string; label: string }
  | { kind: 'text'; label: string }

const WEB_URL = /^https?:\/\//i

export function markdownImage(src: string, alt: string): MarkdownImage {
  if (src.startsWith('data:image/')) return { kind: 'image', src }
  // A protocol-relative URL would resolve against the app's own scheme, not the web.
  const href = src.startsWith('//') ? `https:${src}` : src
  if (WEB_URL.test(href)) return { kind: 'link', href, label: alt || href }
  return { kind: 'text', label: alt }
}
