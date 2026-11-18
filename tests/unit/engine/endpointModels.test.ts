import { describe, expect, it } from 'vitest'
import { removeEndpointModel } from '../../../src/main/infrastructure/engine/endpointModels'
import { EndpointModelRemovalSchema } from '../../../src/shared/channels'

function engineAnswering(answer: { code: number; stdout: string; stderr: string }): {
  calls: Array<{ args: string[]; profile: string | undefined }>
  cli: (args: string[], profile?: string) => Promise<typeof answer>
} {
  const calls: Array<{ args: string[]; profile: string | undefined }> = []
  return {
    calls,
    cli: async (args, profile) => {
      calls.push({ args, profile })
      return answer
    }
  }
}

describe('removing a model from an endpoint in the engine config', () => {
  it("should unset the model in that bot's endpoint, its dots kept literal", async () => {
    const engine = engineAnswering({ code: 0, stdout: 'Unset', stderr: '' })

    await removeEndpointModel(engine, {
      profile: 'scout',
      endpoint: 'local-127.0.0.1:8283',
      model: 'gpt-5.1'
    })

    expect(engine.calls).toEqual([
      {
        args: ['config', 'unset', 'providers.local-127\\.0\\.0\\.1:8283.models.gpt-5\\.1'],
        profile: 'scout'
      }
    ])
  })

  it('should fail with what the engine said when the unset fails', async () => {
    const engine = engineAnswering({ code: 1, stdout: '', stderr: 'warning\nConfig key not set' })

    await expect(
      removeEndpointModel(engine, { profile: 'scout', endpoint: 'local', model: 'small' })
    ).rejects.toThrow('Config key not set')
  })

  it.each([
    ['a profile that is not a name', { profile: '../x', endpoint: 'local', model: 'small' }],
    ['an endpoint id with a backslash', { profile: 'scout', endpoint: 'a\\b', model: 'small' }],
    ['a model with a backslash', { profile: 'scout', endpoint: 'local', model: 'a\\.b' }],
    ['a model with a line break', { profile: 'scout', endpoint: 'local', model: 'a\nb' }],
    ['an empty model', { profile: 'scout', endpoint: 'local', model: '' }],
    ['a model with a tab', { profile: 'scout', endpoint: 'local', model: 'a\tb' }],
    ['a model with a space at the end', { profile: 'scout', endpoint: 'local', model: 'small ' }]
  ])('should refuse %s from the page', (_case, drop) => {
    expect(EndpointModelRemovalSchema.safeParse(drop).success).toBe(false)
  })

  it.each(['openrouter/qwen3:4b-1.5', 'Go reasoning'])(
    'should take the model id %s as Settings saves it',
    (model) => {
      const drop = { profile: 'scout', endpoint: 'local', model }
      expect(EndpointModelRemovalSchema.parse(drop)).toEqual(drop)
    }
  )
})
