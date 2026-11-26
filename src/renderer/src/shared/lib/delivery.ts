// How the engine words a message one bot delivered to another:
// `Message from 🤖 <name> (@<handle>): <text>`.
const OPENING = 'Message from 🤖 '
const DELIVERY = /^Message from 🤖 (.+?) \(@([^\s)]+)\):\s*([\s\S]*)$/
// What the engine ends a preview with when it cut it short.
const CUT = '...'
const REGEX_CHARS = /[.*+?^${}()|[\]\\]/g

/** A message another bot delivered, taken apart; null for any other text. */
export function readDelivery(text: string): { name: string; profile: string; body: string } | null {
  const [, name, profile, body] = DELIVERY.exec(text) ?? []
  return name !== undefined && profile !== undefined && body !== undefined
    ? { name, profile, body }
    : null
}

/**
 * The words of a delivered message in a preview, which the engine may have cut short: empty when
 * the cut fell inside the wrapper or left no words, so the wrapper itself is never shown. Null for
 * any other text.
 */
export function deliveryPreview(preview: string): string | null {
  if (!preview.startsWith(OPENING)) return null
  const body = readDelivery(preview)?.body ?? ''
  return body === CUT ? '' : body
}

/** Talyx's handle in the engine, and the name the chat shows for it. */
export interface ManagerName {
  handle: string | null
  name: string
}

/** One text as shown, with the engine's handle for Talyx read as Talyx's name. */
export function namedText(text: string, manager: ManagerName): string {
  if (!manager.handle) return text
  // Not inside an address (ops@acme.com), nor the start of a longer handle (`@acme-cfo`).
  const handle = new RegExp(
    `(?<![\\w.-])@${manager.handle.replace(REGEX_CHARS, '\\$&')}(?![\\w-])`,
    'g'
  )
  return text.replace(handle, `@${manager.name}`)
}
