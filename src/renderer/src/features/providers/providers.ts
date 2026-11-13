import { CONFIG_YAML_SOURCE, namedTwinOfBare } from '@shared/engine/endpoints'
import type { CustomEndpoint, OAuthProvider, OAuthStartResponse } from '@shared/engine/types'
import type { TranslationKey } from '@shared/lib/i18n'
import { AppError, isTimeout } from '@shared/lib/problem'

export type { CustomEndpoint, OAuthStartResponse }

export interface ProvidersBackend {
  /** The profile new bots copy their model and endpoint from; every bot reads its sign-ins. */
  home: string
  /** Every profile on the engine, the home one included. */
  profiles: () => Promise<string[]>
  /** The home profile's provider keys, one slot per provider. */
  keys: () => Promise<KeySlot[]>
  endpoints: (profile: string) => Promise<CustomEndpoint[]>
  /** The home profile's sign-ins. */
  accounts: () => Promise<Account[]>
  /** Talyx's model, or null when it has none. */
  model: () => Promise<ModelPick | null>
  saveKey: (profile: string, slot: { key: string; value: string }) => Promise<void>
  removeKey: (profile: string, key: string) => Promise<void>
  hasKey: (profile: string, key: string) => Promise<boolean>
  revealKey: (key: string) => Promise<string>
  checkKey: (slot: { key: string; value: string }) => Promise<KeyCheck>
  checkEndpoint: (draft: EndpointDraft) => Promise<EndpointCheck>
  /** `draft.models` are trimmed, unique and not empty. */
  saveEndpoint: (profile: string, draft: EndpointDraft) => Promise<void>
  removeEndpoint: (profile: string, id: string) => Promise<void>
  /** Sets Talyx's model, or returns the question to ask first and saves nothing. */
  setModel: (pick: ModelPick) => Promise<ModelConfirm | null>
  /** Sets Talyx's model after the user said yes to its question. */
  confirmModel: (pick: ModelPick) => Promise<void>
  startSignIn: (providerId: string) => Promise<OAuthStartResponse>
  /** One wait for the sign-in; a wait that runs out of time throws a timeout. */
  pollSignIn: (sign: { providerId: string; sessionId: string }) => Promise<SignInPoll>
  submitSignInCode: (sign: {
    providerId: string
    sessionId: string
    code: string
  }) => Promise<SignInResult>
  cancelSignIn: (sessionId: string) => Promise<void>
  signOut: (id: string) => Promise<void>
}

/**
 * What the provider said about the key: `unchecked` when the engine could not reach it, which is
 * no verdict (the key can still be saved); `message` says why a key was rejected.
 */
export interface KeyCheck {
  verdict: 'works' | 'rejected' | 'unchecked'
  message: string
}

/** `models` is what the endpoint serves. */
export interface EndpointCheck {
  ok: boolean
  message: string
  models: string[]
}

export type SignInPoll =
  | { status: 'approved' }
  | { status: 'pending' }
  | { status: 'failed'; message: string }

// The operations a write to every bot needs.
type EveryBot = Pick<ProvidersBackend, 'home' | 'profiles'>

/** One provider's API key, as the engine's key catalog lists it. */
export interface KeySlot {
  key: string
  provider: string
  docsUrl: string | null
  /** The engine's masked preview; null when no key is saved. */
  preview: string | null
}

export interface Account {
  id: string
  name: string
  flow: OAuthProvider['flow']
  signedIn: boolean
  /** False for a sign-in another tool owns; it is removed there. */
  disconnectable: boolean
  /** The command that signs in an external account. */
  command: string
}

export interface ModelPick {
  provider: string
  model: string
}

/** The engine wants a yes before it makes this model Talyx's; nothing is saved yet. */
export interface ModelConfirm {
  message: string
  model: ModelPick
}

export interface ProvidersOverview {
  keys: KeySlot[]
  endpoints: CustomEndpoint[]
  accounts: Account[]
  model: ModelPick | null
}

export interface EndpointDraft {
  /** The endpoint being edited; null adds a new one. */
  editing: CustomEndpoint | null
  name: string
  baseUrl: string
  /** Blank keeps the saved key. */
  apiKey: string
  models: string[]
}

export type SignInResult =
  | { status: 'approved' }
  | { status: 'failed'; message: string }
  | { status: 'cancelled' }

// Thrown for a providers problem the user can act on; `key` is its message in i18n.ts.
export class ProvidersError extends AppError {
  constructor(key: TranslationKey, detail: string | null = null) {
    super(key, detail)
    this.name = 'ProvidersError'
  }
}

export async function loadProviders(
  backend: Pick<ProvidersBackend, 'home' | 'keys' | 'endpoints' | 'accounts' | 'model'>
): Promise<ProvidersOverview> {
  const [keys, endpoints, accounts, model] = await Promise.all([
    backend.keys(),
    backend.endpoints(backend.home),
    backend.accounts(),
    backend.model()
  ])
  return {
    keys,
    // The bare endpoint is the active one and carries the badge; its named copy would repeat it.
    endpoints: endpoints.filter((endpoint) => endpoint !== namedTwinOfBare(endpoints)),
    accounts,
    model
  }
}

/** Saves the key on every bot; returns the bots that did not take it. */
export function saveKey(
  backend: EveryBot & Pick<ProvidersBackend, 'saveKey'>,
  slot: { key: string; value: string }
): Promise<string[]> {
  const value = slot.value.trim()
  if (!value) throw new ProvidersError('providers.errorKeyEmpty')
  return onEveryBot(backend, (profile) => backend.saveKey(profile, { key: slot.key, value }))
}

export function removeKey(
  backend: EveryBot & Pick<ProvidersBackend, 'removeKey' | 'hasKey'>,
  key: string
): Promise<string[]> {
  return onEveryBot(backend, (profile) =>
    removing(backend.removeKey(profile, key), () => backend.hasKey(profile, key))
  )
}

/** The saved key in full, only on an explicit ask. */
export function revealKey(
  backend: Pick<ProvidersBackend, 'revealKey'>,
  key: string
): Promise<string> {
  return backend.revealKey(key)
}

export function checkKey(
  backend: Pick<ProvidersBackend, 'checkKey'>,
  slot: { key: string; value: string }
): Promise<KeyCheck> {
  return backend.checkKey({ key: slot.key, value: slot.value.trim() })
}

/** Probes the endpoint's model list. */
export function checkEndpoint(
  backend: Pick<ProvidersBackend, 'checkEndpoint'>,
  draft: EndpointDraft
): Promise<EndpointCheck> {
  return backend.checkEndpoint(draft)
}

/**
 * Saves the endpoint on every bot. The engine adds the listed models to the ones it has and
 * never drops one, so an edit can only add models. It never changes a bot's model; the default
 * model picks one of them.
 */
export function saveEndpoint(
  backend: EveryBot & Pick<ProvidersBackend, 'saveEndpoint'>,
  draft: EndpointDraft
): Promise<string[]> {
  const models = [...new Set(draft.models.map((model) => model.trim()).filter(Boolean))]
  if (!draft.name.trim() || !draft.baseUrl.trim())
    throw new ProvidersError('providers.errorEndpointIncomplete')
  if (models.length === 0) throw new ProvidersError('providers.errorEndpointNoModels')
  if (keyMustBeRetyped(draft.editing) && !draft.apiKey.trim())
    throw new ProvidersError('providers.errorEndpointKeyNeeded')
  return onEveryBot(backend, (profile) => backend.saveEndpoint(profile, { ...draft, models }))
}

/**
 * An endpoint written straight into config.yaml keeps its key there. A save moves it into the
 * engine's endpoint list and keeps only a key it is handed, so without one its bots lose access.
 */
export function keyMustBeRetyped(endpoint: CustomEndpoint | null): boolean {
  return endpoint?.source === CONFIG_YAML_SOURCE
}

/** The engine removes only endpoints from its own list, never one written into config.yaml. */
export function canRemoveEndpoint(endpoint: CustomEndpoint): boolean {
  return endpoint.source !== CONFIG_YAML_SOURCE
}

/** Removes the endpoint from every bot; a bot whose model it served falls back to its default. */
export function removeEndpoint(
  backend: EveryBot & Pick<ProvidersBackend, 'removeEndpoint' | 'endpoints'>,
  id: string
): Promise<string[]> {
  return onEveryBot(backend, (profile) =>
    removing(backend.removeEndpoint(profile, id), async () =>
      (await backend.endpoints(profile)).some((endpoint) => endpoint.id === id)
    )
  )
}

/**
 * Talyx's model, which new bots copy; other bots keep the model each one has. For a costly model
 * the engine saves nothing and asks first: the question comes back, `confirmDefaultModel` answers.
 */
export function setDefaultModel(
  backend: Pick<ProvidersBackend, 'setModel'>,
  pick: ModelPick
): Promise<ModelConfirm | null> {
  return backend.setModel(pick)
}

export function confirmDefaultModel(
  backend: Pick<ProvidersBackend, 'confirmModel'>,
  pick: ModelPick
): Promise<void> {
  return backend.confirmModel(pick)
}

/** Opens a sign-in; the caller shows its code or page, then waits or submits. */
export function startSignIn(
  backend: Pick<ProvidersBackend, 'startSignIn'>,
  providerId: string
): Promise<OAuthStartResponse> {
  return backend.startSignIn(providerId)
}

/**
 * Waits for a device-code sign-in to finish in the browser; `live()` false stops waiting. A poll
 * that times out is asked again: the engine's session keeps waiting until `expiresAt` (epoch ms).
 */
export async function waitForSignIn(
  backend: Pick<ProvidersBackend, 'pollSignIn'>,
  sign: { providerId: string; sessionId: string; expiresAt: number; live: () => boolean }
): Promise<SignInResult> {
  while (sign.live()) {
    const result = await backend
      .pollSignIn({ providerId: sign.providerId, sessionId: sign.sessionId })
      .catch((error: unknown): SignInPoll | null => {
        if (!isTimeout(error)) throw error
        if (Date.now() < sign.expiresAt) return null
        return { status: 'failed', message: 'expired' }
      })
    if (!sign.live()) break
    if (!result || result.status === 'pending') continue
    return result
  }
  return { status: 'cancelled' }
}

/** Hands the engine the code the provider's page showed. */
export function submitSignInCode(
  backend: Pick<ProvidersBackend, 'submitSignInCode'>,
  sign: { providerId: string; sessionId: string; code: string }
): Promise<SignInResult> {
  return backend.submitSignInCode({ ...sign, code: sign.code.trim() })
}

export function cancelSignIn(
  backend: Pick<ProvidersBackend, 'cancelSignIn'>,
  sessionId: string
): Promise<void> {
  return backend.cancelSignIn(sessionId)
}

/** Signs Talyx out of the account; bots without a sign-in of their own lose it too. */
export function disconnectAccount(
  backend: Pick<ProvidersBackend, 'signOut'>,
  id: string
): Promise<void> {
  return backend.signOut(id)
}

// A bot that never had it refuses the removal; that bot is done all the same.
async function removing(
  remove: Promise<unknown>,
  stillThere: () => Promise<boolean>
): Promise<void> {
  try {
    await remove
  } catch (error) {
    if (await stillThere()) throw error
  }
}

// The home profile goes first: if it refuses the change, no bot gets it.
async function onEveryBot(
  backend: EveryBot,
  write: (profile: string) => Promise<unknown>
): Promise<string[]> {
  await write(backend.home)
  const others = (await backend.profiles()).filter((profile) => profile !== backend.home)
  const results = await Promise.allSettled(others.map(write))
  return others.filter((_, index) => results[index].status === 'rejected')
}
