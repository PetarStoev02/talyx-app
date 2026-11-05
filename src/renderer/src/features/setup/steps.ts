import { engineVersionFit, type EngineStatus } from '../../../../shared/engine'

export type SetupStep = 'engine' | 'provider' | 'bot'

export interface SetupFacts {
  engine: EngineStatus
  hasProvider: boolean
  hasOwnBot: boolean
}

// The part of the providers overview that decides this; features may not import each other, so
// ProvidersOverview satisfies it structurally.
export interface ProviderPresence {
  keys: Array<{ preview: string | null }>
  endpoints: unknown[]
  accounts: Array<{ signedIn: boolean }>
}

export function firstUndoneStep(facts: SetupFacts): SetupStep | null {
  if (!isEngineDone(facts.engine)) return 'engine'
  if (!facts.hasProvider) return 'provider'
  if (!facts.hasOwnBot) return 'bot'
  return null
}

export function hasProvider(overview: ProviderPresence): boolean {
  return (
    overview.keys.some((slot) => slot.preview !== null) ||
    overview.endpoints.length > 0 ||
    overview.accounts.some((account) => account.signedIn)
  )
}

// `firstStep` is undefined until the facts are read. `hidden` with `setupDone` false means
// everything is already done: the caller then saves `setupDone` through `useSetup.finish`.
export function setupVisibility(
  setupDone: boolean | null,
  firstStep: SetupStep | null | undefined
): 'loading' | 'show' | 'hidden' {
  if (setupDone === null) return 'loading'
  if (setupDone) return 'hidden'
  if (firstStep === undefined) return 'loading'
  return firstStep === null ? 'hidden' : 'show'
}

// An unreadable version counts as done: the engine runs, so the user is not sent to reinstall.
function isEngineDone(engine: EngineStatus): boolean {
  return engine.state === 'attached' && engineVersionFit(engine.version) !== 'older'
}
