import type { EngineApiRequest, EngineHttp } from '../../../src/renderer/src/shared/engine/http'
import { providersDouble } from '../../unit/providers/providersDouble'

const POLL_DELAY_MS = 1500
/** Every bot's provider and model. */
export const PROVIDER = 'anthropic'
export const DEFAULT_MODEL = 'claude-sonnet-4-5'
/** The model the double asks about before pinning, as the engine does for a costly one. */
export const COSTLY_MODEL = 'claude-opus-4-1'

/**
 * The Providers page's engine REST: the unit tests' in-memory double, with every bot on one endpoint
 * and a device-code sign-in the "browser" approves on the second poll. A pasted code `good` is
 * accepted.
 */
export function fixtureProviders(profiles: string[]): EngineHttp {
  const engine = providersDouble(profiles)
  for (const config of Object.values(engine.profiles)) {
    config.endpoints[0] = {
      ...config.endpoints[0],
      id: PROVIDER,
      name: 'Anthropic',
      base_url: 'https://api.anthropic.com/v1',
      model: DEFAULT_MODEL,
      models: [DEFAULT_MODEL, COSTLY_MODEL]
    }
    config.model = { provider: PROVIDER, model: DEFAULT_MODEL }
  }
  let polls = 0
  return async <T>(request: EngineApiRequest): Promise<T> => {
    if (request.path.includes('/poll/')) {
      await new Promise((resolve) => setTimeout(resolve, POLL_DELAY_MS))
      polls += 1
      if (polls % 2 === 0) engine.polls.push('approved')
    }
    // The unit double confirms its own costly model; this one confirms COSTLY_MODEL.
    const body = (request.body ?? {}) as { model?: string; confirm_expensive_model?: boolean }
    if (
      request.path.startsWith('/api/model/set') &&
      body.model === COSTLY_MODEL &&
      !body.confirm_expensive_model
    )
      return {
        ok: false,
        confirm_required: true,
        confirm_message: `${COSTLY_MODEL} costs more.`
      } as T
    return engine.http<T>(request)
  }
}
