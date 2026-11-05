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

const ORDER: SetupStep[] = ['engine', 'provider', 'bot']

export function firstUndoneStep(facts: SetupFacts): SetupStep | null {
  return stepAfter(null, facts)
}

/** The next step after `current` (null: from the start) that is not done; null when none is left. */
export function stepAfter(current: SetupStep | null, facts: SetupFacts): SetupStep | null {
  const rest = current === null ? ORDER : ORDER.slice(ORDER.indexOf(current) + 1)
  return rest.find((step) => !isDone(step, facts)) ?? null
}

/**
 * The first undone step while the provider and bot facts may still be loading: they can only be
 * read from an attached engine, so an engine that is not done decides alone. Undefined until known.
 */
export function knownFirstStep(facts: {
  engine: EngineStatus
  hasProvider: boolean | null
  hasOwnBot: boolean | null
}): SetupStep | null | undefined {
  const { engine, hasProvider, hasOwnBot } = facts
  if (!isEngineDone(engine)) return 'engine'
  if (hasProvider === null || hasOwnBot === null) return undefined
  return firstUndoneStep({ engine, hasProvider, hasOwnBot })
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

function isDone(step: SetupStep, facts: SetupFacts): boolean {
  if (step === 'engine') return isEngineDone(facts.engine)
  return step === 'provider' ? facts.hasProvider : facts.hasOwnBot
}

// An unreadable version counts as done: the engine runs, so the user is not sent to reinstall.
function isEngineDone(engine: EngineStatus): boolean {
  return engine.state === 'attached' && engineVersionFit(engine.version) !== 'older'
}
