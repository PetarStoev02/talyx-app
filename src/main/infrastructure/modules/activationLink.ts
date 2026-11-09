import { ACTIVATION_LINK, type ActivationRequest } from '../../../shared/modules'

const MAX_KEY_LENGTH = 2000

/**
 * The request an activation link carries, or null when the URL is anything else. The key is only
 * filled into the dialog: the user still confirms, so a link alone never activates anything.
 */
export function activationRequestFrom(url: string): ActivationRequest | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (
    parsed.protocol !== `${ACTIVATION_LINK.scheme}:` ||
    parsed.hostname !== ACTIVATION_LINK.action
  )
    return null
  const key = parsed.searchParams.get('key')
  return { key: key && key.length <= MAX_KEY_LENGTH ? key : null }
}

/** On Linux an opened link arrives as an argument of a new instance. */
export function activationRequestIn(argv: string[]): ActivationRequest | null {
  for (const arg of argv) {
    const request = activationRequestFrom(arg)
    if (request) return request
  }
  return null
}
