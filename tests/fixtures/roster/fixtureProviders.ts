import type { EngineApiRequest, EngineHttp } from '../../../src/renderer/src/shared/engine/http'
import { providersDouble } from '../../unit/providers/providersDouble'
import type { EndpointModelConfig, MainCalls } from '../../../src/renderer/src/app/engine/providers'

const POLL_DELAY_MS = 1500
/** Every bot's provider and model. */
export const PROVIDER = 'anthropic'
export const DEFAULT_MODEL = 'claude-sonnet-4-5'
const BASE_URL = 'https://api.anthropic.com/v1'
/** The model the double asks about before pinning, as the engine does for a costly one. */
export const COSTLY_MODEL = 'claude-opus-4-1'

/**
 * The Providers page's engine REST: the unit tests' in-memory double, with every bot on one endpoint
 * and a device-code sign-in the "browser" approves on the second poll. A pasted code `good` is
 * accepted. `config` takes a model off an endpoint, as main's config unset does. Usage: the endpoint has some on every
 * bot, the OpenAI key and the sign-in none.
 */
export function fixtureProviders(profiles: string[]): {
  http: EngineHttp
  config: EndpointModelConfig
} {
  const engine = providersDouble(profiles)
  for (const config of Object.values(engine.profiles)) {
    const [endpoint] = config.endpoints
    if (!endpoint) throw new Error('fixtureProviders needs an endpoint on every profile')
    config.endpoints[0] = {
      ...endpoint,
      id: PROVIDER,
      name: 'Anthropic',
      base_url: BASE_URL,
      model: DEFAULT_MODEL,
      models: [DEFAULT_MODEL, COSTLY_MODEL]
    }
    config.model = { provider: PROVIDER, model: DEFAULT_MODEL }
    // Every bot ran on the endpoint this month; the saved OpenAI key below ran nothing.
    config.usage = [
      {
        model: DEFAULT_MODEL,
        provider: `custom:${PROVIDER}`,
        input_tokens: 182_400,
        output_tokens: 23_900,
        api_calls: 61
      }
    ]
  }
  const [first] = profiles
  const home = first === undefined ? undefined : engine.profiles[first]
  if (!home) throw new Error('fixtureProviders needs at least one profile')
  home.env.OPENAI_API_KEY = 'sk-fixture-openai'
  let polls = 0
  const http = async <T>(request: EngineApiRequest): Promise<T> => {
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
  return { http, config: engine.config }
}

const DAY_MS = 86_400_000

/**
 * Talyx's usage plugin for the fixture: every bot on the endpoint each day of the period, busier
 * mid-week, so the Usage page's charts have a shape. The saved OpenAI key ran nothing.
 */
export const fixturePlugins: Pick<MainCalls, 'usageDays'> = {
  usageDays: async ({ profiles, days }) =>
    Object.fromEntries(
      profiles.map((profile, bot) => [
        profile,
        {
          rows: Array.from({ length: days }, (_, back) => {
            const date = new Date(Date.now() - back * DAY_MS)
            const weekday = date.getDay()
            const busy = weekday === 0 || weekday === 6 ? 0.2 : 1 + Math.sin(back + bot) / 2
            return {
              day: date.toLocaleDateString('en-CA'),
              model: DEFAULT_MODEL,
              provider: 'custom',
              base_url: BASE_URL,
              input_tokens: Math.round(6_000 * busy * (bot + 1)),
              output_tokens: Math.round(800 * busy * (bot + 1)),
              api_calls: Math.round(2 * busy * (bot + 1))
            }
          })
        }
      ])
    )
}
