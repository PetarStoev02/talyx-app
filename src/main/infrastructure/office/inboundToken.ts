import { randomBytes } from 'node:crypto'
import type { SecretStore } from './SecretStore'

export const INBOUND_TOKEN = 'inbound-token'

export function rotateInboundToken(secrets: Pick<SecretStore, 'set'>): void {
  secrets.set(INBOUND_TOKEN, randomBytes(32).toString('base64url'))
}

export function ensureInboundToken(secrets: Pick<SecretStore, 'get' | 'set'>): void {
  if (!secrets.get(INBOUND_TOKEN)) rotateInboundToken(secrets)
}
