import { describe, expect, it } from 'vitest'
import { replyFailure } from '@features/chat/replyFailure'

const NO_PROVIDER =
  '⚠️ Fakeengine is not connected to any AI provider yet. Run `fakeengine model` to pick one. ' +
  '(Advanced: put an API key in ~/.fakeengine/profiles/analyst/.env.)'

describe('replyFailure', () => {
  it("should show Talyx's own line when the bot has no model provider", () => {
    expect(replyFailure(NO_PROVIDER, 'fakeengine')).toEqual({ kind: 'noProvider' })
  })

  it("should show any other failure in the engine's words with its name as Talyx's command", () => {
    expect(
      replyFailure('Fakeengine hit a rate limit; see `fakeengine logs`.', 'fakeengine')
    ).toEqual({
      kind: 'engine',
      text: 'talyx-engine hit a rate limit; see `talyx-engine logs`.'
    })
  })

  it('should leave the text as it is while no engine is attached', () => {
    expect(replyFailure('Timed out', null)).toEqual({ kind: 'engine', text: 'Timed out' })
  })
})
