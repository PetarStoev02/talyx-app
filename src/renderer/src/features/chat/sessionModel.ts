import type { ModelPick } from '@shared/ui/ModelPicker'

type Request = (
  profile: string,
  method: string,
  params: Record<string, unknown>
) => Promise<unknown>

export interface SessionTarget {
  profile: string
  sessionId: string
}

/** What a model change is fenced by, and the subscription the resume that read it opened. */
export interface SessionFence {
  revision: number
  generation: number
  subscription: string | null
}

// The engine refuses a model through `config.set`: it takes a mutation fenced by the session's
// current revision and generation, and only a resume reports those.
export async function resumeForChange(
  request: Request,
  target: SessionTarget
): Promise<SessionFence> {
  const snapshot = (await request(target.profile, 'session.resume', {
    session_id: target.sessionId,
    defer_history: true,
    omit_messages: true
  })) as { revision: number; execution_generation: number; subscription_id?: string }
  return {
    revision: snapshot.revision,
    generation: snapshot.execution_generation,
    subscription: snapshot.subscription_id ?? null
  }
}

export async function changeModel(
  request: Request,
  target: SessionTarget & { fence: SessionFence },
  choice: ModelPick
): Promise<void> {
  await request(target.profile, 'session.mutate', {
    session_id: target.sessionId,
    request_id: crypto.randomUUID(),
    expected_revision: target.fence.revision,
    expected_generation: target.fence.generation,
    operation: 'model',
    payload: { model: choice.model, provider: choice.provider }
  })
}
