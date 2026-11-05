import { useEffect } from 'react'
import { loadProviders, type ProvidersBackend } from '@features/providers/providers'
import { hasProvider, knownFirstStep, type SetupStep } from '@features/setup/steps'
import { useSetup } from '@features/setup/store'
import { reportError } from '@shared/lib/report'
import { useEngine } from './useEngine'

/**
 * Where an unfinished setup starts; undefined until known. Reads whether a provider and an own bot
 * exist once the engine is attached (they live in the engine), into `useSetup` for the flow.
 */
export function useFirstSetupStep(
  providers: ProvidersBackend | null
): SetupStep | null | undefined {
  const engine = useEngine((s) => s.status)
  const setupDone = useSetup((s) => s.setupDone)
  const hasProviderNow = useSetup((s) => s.hasProvider)
  const hasOwnBot = useSetup((s) => s.hasOwnBot)

  useEffect(() => {
    if (setupDone !== false || !providers) return
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
        // Unreadable counts as not done: the flow shows the step, and each step can be skipped.
        if (!current) return
        useSetup.getState().setHasProvider(false)
        useSetup.getState().setHasOwnBot(false)
      }
    )
    return () => {
      current = false
    }
  }, [setupDone, providers])

  if (!engine) return undefined
  return knownFirstStep({ engine, hasProvider: hasProviderNow, hasOwnBot })
}
