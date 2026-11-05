import type { ProvidersBackend } from '../../../src/renderer/src/features/providers/providers'
import { providersDouble } from '../../unit/providers/providersDouble'

const POLL_DELAY_MS = 1500

/**
 * The Providers page's engine: the unit tests' in-memory double, with every bot on the router and
 * a device-code sign-in the "browser" approves on the second poll. A pasted code `good` is accepted.
 */
export function fixtureProviders(profiles: string[]): ProvidersBackend {
  const engine = providersDouble(profiles)
  for (const config of Object.values(engine.profiles))
    config.endpoints[0].models = ['9-route-provider', 'paid-model']
  let polls = 0
  return {
    ...engine.backend,
    http: async (request) => {
      if (request.path.includes('/poll/')) {
        await new Promise((resolve) => setTimeout(resolve, POLL_DELAY_MS))
        polls += 1
        if (polls % 2 === 0) engine.polls.push('approved')
      }
      return engine.backend.http(request)
    }
  }
}
