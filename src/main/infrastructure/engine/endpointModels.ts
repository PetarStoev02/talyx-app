import type { Engine } from './engine'
import { lastLine } from './roomMembers'

export interface EndpointModelRemoval {
  profile: string
  endpoint: string
  model: string
}

/**
 * Takes one model off a bot's custom endpoint. The engine's REST save merges model lists and
 * never drops one, so this goes through its config unset instead. Ids and models hold dots
 * (`gpt-5.1`, `127.0.0.1`); escaped, the engine reads each as one key.
 */
export async function removeEndpointModel(
  engine: Pick<Engine, 'cli'>,
  removal: EndpointModelRemoval
): Promise<void> {
  const key = ['providers', removal.endpoint, 'models', removal.model]
    .map((part) => part.replaceAll('.', '\\.'))
    .join('.')
  const result = await engine.cli(['config', 'unset', key], removal.profile)
  if (result.code !== 0) {
    throw new Error(lastLine(result) || `The model was not removed (exit ${result.code})`)
  }
}
