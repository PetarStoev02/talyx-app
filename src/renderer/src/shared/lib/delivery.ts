// How the engine words a message one bot delivered to another:
// `Message from 🤖 <name> (@<handle>): <text>`.
const DELIVERY = /^Message from 🤖 (.+?) \(@([^\s)]+)\):\s*([\s\S]*)$/

/** A message another bot delivered, taken apart; null for any other text. */
export function readDelivery(text: string): { name: string; profile: string; body: string } | null {
  const [, name, profile, body] = DELIVERY.exec(text) ?? []
  return name !== undefined && profile !== undefined && body !== undefined
    ? { name, profile, body }
    : null
}
