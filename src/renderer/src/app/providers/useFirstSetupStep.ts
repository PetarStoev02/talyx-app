import { useEffect } from 'react'
import { loadProviders, type ProvidersBackend } from '@features/providers/providers'
import { hasProvider, knownFirstStep, type SetupStep } from '@features/setup/steps'
import { useSetup } from '@features/setup/store'
import { reportError } from '@shared/lib/report'
import { useEngine } from './useEngine'

/**
 * Where an unfinished setup starts; undefined until known. Reads whether a provider and an own bot
 * exist (they live in the engine) each time the engine attaches and when Run setup again starts or
 * ends, into `useSetup` for the flow and for the chat's provider nudge.
 */
export function useFirstSetupStep(
  providers: ProvidersBackend | null
): SetupStep | null | undefined {
  const engine = useEngine((s) => s.status)
  // Run setup again clears the facts; reading on its change fills them in again.
  const forced = useSetup((s) => s.forced)
  const hasProviderNow = useSetup((s) => s.hasProvider)
  const hasOwnBot = useSetup((s) => s.hasOwnBot)

  useEffect(() => {
    // `providers` is null until the engine attaches and a new one each time it does.
    if (!providers) return
    let current = true
    Promise.all([loadProviders(providers), providers.profiles()]).then(
      ([overview, profiles]) => {
        if (!current) return
        useSetup.getState().setHasProvider(hasProvider(overview))
        // Any profile besides the manager's (home) is a bot the user made.
        useSetup.getState().setHasOwnBot(profiles.some((name) => name !== providers.home))
      },
      (error: unknown) => {
        reportError('setup', error)
        // Unreadable counts as not done, or an unfinished setup would wait on it: the flow shows
        // the step, and each step can be skipped. A finished setup leaves it unknown: no nudge.
        if (!current || useSetup.getState().setupDone === true) return
        useSetup.getState().setHasProvider(false)
        useSetup.getState().setHasOwnBot(false)
      }
    )
    return () => {
      current = false
    }
  }, [forced, providers])

  if (!engine) return undefined
  return knownFirstStep({ engine, hasProvider: hasProviderNow, hasOwnBot })
}
