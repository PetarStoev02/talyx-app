import type { EngineHttp } from './http'
import type { ModelAssignmentRequest, ModelAssignmentResponse } from './types'

/**
 * Pins one profile's main model over REST. For a costly model the engine saves nothing and
 * answers `confirm_required`; the same call with `confirm_expensive_model` pins it.
 */
export function assignMainModel(
  http: EngineHttp,
  profile: string,
  body: Omit<ModelAssignmentRequest, 'scope'>
): Promise<ModelAssignmentResponse> {
  return http<ModelAssignmentResponse>({
    path: `/api/model/set?${new URLSearchParams({ profile })}`,
    method: 'POST',
    body: { scope: 'main', ...body },
    profile
  })
}
