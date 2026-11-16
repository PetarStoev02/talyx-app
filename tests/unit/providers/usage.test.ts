import { beforeEach, describe, expect, it } from 'vitest'
import { loadProviders } from '../../../src/renderer/src/features/providers/providers'
import {
  USAGE_PERIODS,
  dailySeries,
  daysOf,
  loadUsage
} from '../../../src/renderer/src/features/providers/usage'
import { HOME, ROUTER, providersDouble } from './providersDouble'
import type { DailyRow, ProvidersDouble, UsageRow } from './providersDouble'

const row = (patch: Partial<UsageRow> = {}): UsageRow => ({
  model: ROUTER.model,
  provider: 'custom',
  input_tokens: 900,
  output_tokens: 100,
  api_calls: 2,
  ...patch
})

// The ids only tell providers apart; the tests name them.
function withoutIds<T extends object>(items: T[]): Omit<T, 'id' | 'providerId'>[] {
  return items.map((item) => {
    const rest: Record<string, unknown> = { ...item }
    delete rest.id
    delete rest.providerId
    return rest as Omit<T, 'id' | 'providerId'>
  })
}

describe('provider usage', () => {
  let engine: ProvidersDouble

  beforeEach(() => {
    engine = providersDouble()
    // Settings lists only the endpoint until a test adds a key or a sign-in.
    engine.accounts[2].status = { logged_in: false }
  })

  async function usage(days = 30): Promise<Awaited<ReturnType<typeof loadUsage>>> {
    return loadUsage(engine.backend, { overview: await loadProviders(engine.backend), days })
  }

  it('should say every configured provider reported no usage when no bot ran', async () => {
    const report = await usage()

    expect(report).toMatchObject({
      providers: [{ name: 'Custom', usage: null }],
      models: [],
      total: { tokens: 0, requests: 0 },
      unread: []
    })
  })

  it("should add up one endpoint's usage across every bot", async () => {
    engine.profiles[HOME].usage = [row()]
    engine.profiles.analyst.usage = [row({ input_tokens: 40, output_tokens: 10, api_calls: 1 })]

    const providers = withoutIds((await usage()).providers)

    expect(providers).toEqual([{ name: 'Custom', usage: { tokens: 1050, requests: 3 } }])
  })

  it('should split usage by provider and name each one as Settings lists it', async () => {
    engine.profiles[HOME].env.OPENAI_API_KEY = 'sk-openai'
    // The Claude Code sign-in's usage is recorded under its provider, Anthropic.
    engine.accounts[2].name = 'Claude account'
    engine.accounts[2].status = { logged_in: true }
    engine.profiles[HOME].usage = [
      row(),
      row({ model: 'gpt-5', provider: 'openai', input_tokens: 5, output_tokens: 5, api_calls: 1 }),
      row({ model: 'claude-x', provider: 'anthropic', input_tokens: 7, output_tokens: 3 })
    ]

    const providers = withoutIds((await usage()).providers)

    expect(providers).toEqual([
      { name: 'Custom', usage: { tokens: 1000, requests: 2 } },
      { name: 'OpenAI API', usage: { tokens: 10, requests: 1 } },
      { name: 'Claude account', usage: { tokens: 10, requests: 2 } }
    ])
  })

  it("should give a key shared by two providers each provider's own usage", async () => {
    engine.profiles[HOME].env.DASHSCOPE_API_KEY = 'sk-dashscope'
    engine.profiles[HOME].usage = [
      row({ provider: 'qwen', api_calls: 1 }),
      row({ provider: 'alibaba', input_tokens: 5, output_tokens: 5, api_calls: 3 })
    ]

    const providers = withoutIds((await usage()).providers)

    expect(providers).toEqual([
      { name: 'Custom', usage: null },
      { name: 'Qwen Cloud', usage: { tokens: 1000, requests: 1 } },
      { name: 'Alibaba Cloud', usage: { tokens: 10, requests: 3 } }
    ])
  })

  it('should count a provider with both a key and a sign-in once, under the key', async () => {
    engine.profiles[HOME].env.OPENAI_API_KEY = 'sk-openai'
    engine.accounts[0].id = 'openai'
    engine.accounts[0].status = { logged_in: true }
    engine.profiles[HOME].usage = [row({ model: 'gpt-5', provider: 'openai' })]

    const providers = withoutIds((await usage()).providers)

    expect(providers).toEqual([
      { name: 'Custom', usage: null },
      { name: 'OpenAI API', usage: { tokens: 1000, requests: 2 } }
    ])
  })

  it('should say a configured provider with no usage reported none, never zero', async () => {
    engine.profiles[HOME].env.OPENAI_API_KEY = 'sk-openai'
    engine.profiles[HOME].usage = [
      row({ model: 'gpt-5', provider: 'openai', input_tokens: 0, output_tokens: 0, api_calls: 0 })
    ]

    const providers = withoutIds((await usage()).providers)

    expect(providers).toEqual([
      { name: 'Custom', usage: null },
      { name: 'OpenAI API', usage: null }
    ])
  })

  it('should count requests from a provider that reports no tokens', async () => {
    engine.profiles[HOME].usage = [row({ input_tokens: 0, output_tokens: 0, api_calls: 4 })]

    const providers = withoutIds((await usage()).providers)

    expect(providers).toEqual([{ name: 'Custom', usage: { tokens: 0, requests: 4 } }])
  })

  it('should list usage of a provider Settings no longer has, under its id', async () => {
    engine.profiles.writer.usage = [row({ model: 'm', provider: 'gone', api_calls: 1 })]

    const providers = withoutIds((await usage()).providers)

    expect(providers).toEqual([
      { name: 'Custom', usage: null },
      { name: 'gone', usage: { tokens: 1000, requests: 1 } }
    ])
  })

  it('should give each endpoint the usage the engine recorded under it, whatever its models', async () => {
    const lab = {
      ...ROUTER,
      id: 'lab',
      name: 'Lab',
      base_url: 'http://10.0.0.2:8000/v1',
      is_current: false,
      source: 'providers'
    }
    engine.profiles[HOME].endpoints.push(lab)
    engine.profiles[HOME].usage = [
      row({ model: 'shared', provider: 'custom' }),
      row({ model: 'shared', provider: 'custom:lab', input_tokens: 40, output_tokens: 0 }),
      // A model the router no longer lists still ran on it.
      row({ model: 'retired-combo', provider: 'custom', api_calls: 1 })
    ]

    const providers = withoutIds((await usage()).providers)

    expect(providers).toEqual([
      { name: 'Custom', usage: { tokens: 2000, requests: 3 } },
      { name: 'Lab', usage: { tokens: 40, requests: 2 } }
    ])
  })

  it("should count a bot on Talyx's named copy of the active endpoint under that endpoint", async () => {
    const twin = {
      ...ROUTER,
      id: 'endpoint-127-0-0-1-20128',
      name: 'Custom endpoint (127.0.0.1:20128)',
      is_current: false,
      source: 'providers'
    }
    engine.profiles[HOME].endpoints.push(twin)
    engine.profiles[HOME].usage = [row(), row({ provider: `custom:${twin.id}`, api_calls: 1 })]

    const providers = withoutIds((await usage()).providers)

    expect(providers).toEqual([{ name: 'Custom', usage: { tokens: 2000, requests: 3 } }])
  })

  it('should match an endpoint billed under its name as the engine spells it', async () => {
    const lab = {
      ...ROUTER,
      id: 'lab-1',
      name: 'My Lab',
      base_url: 'http://10.0.0.2:8000/v1',
      is_current: false,
      source: 'providers'
    }
    engine.profiles[HOME].endpoints.push(lab)
    engine.profiles[HOME].usage = [row({ provider: 'custom:my-lab' })]

    const providers = withoutIds((await usage()).providers)

    expect(providers).toEqual([
      { name: 'Custom', usage: null },
      { name: 'My Lab', usage: { tokens: 1000, requests: 2 } }
    ])
  })

  it('should name an endpoint Settings no longer lists as the engine recorded it', async () => {
    engine.profiles[HOME].usage = [row({ provider: 'custom:old-box' })]

    const providers = withoutIds((await usage()).providers)

    expect(providers).toEqual([
      { name: 'Custom', usage: null },
      { name: 'old-box', usage: { tokens: 1000, requests: 2 } }
    ])
  })

  it('should list usage the engine recorded under no provider as unknown', async () => {
    engine.profiles[HOME].usage = [row({ provider: '' })]

    const providers = withoutIds((await usage()).providers)

    expect(providers).toEqual([
      { name: 'Custom', usage: null },
      { name: null, usage: { tokens: 1000, requests: 2 } }
    ])
  })

  it('should leave out a provider Settings does not list when it reported nothing', async () => {
    engine.profiles[HOME].usage = [
      row({ provider: '', input_tokens: 0, output_tokens: 0, api_calls: 0 })
    ]

    const providers = withoutIds((await usage()).providers)

    expect(providers).toEqual([{ name: 'Custom', usage: null }])
  })

  it("should name the bots whose usage it could not read and count the others'", async () => {
    engine.profiles[HOME].usage = [row()]
    engine.profiles.writer.usage = null

    const report = await usage()

    expect(report).toMatchObject({
      providers: [{ name: 'Custom', usage: { tokens: 1000, requests: 2 } }],
      unread: ['writer']
    })
  })

  it.each(USAGE_PERIODS)('should ask each bot for the last %i days', async (days) => {
    const asked: string[] = []
    const http = engine.http
    engine.http = (request) => {
      asked.push(request.path)
      return http(request)
    }

    await usage(days)

    const periods = asked.filter((path) => path.startsWith('/api/analytics/models'))
    expect(periods).toHaveLength(3)
    expect(periods.every((path) => path.includes(`days=${days}`))).toBe(true)
  })

  it('should list a model served by two providers once under each', async () => {
    engine.profiles[HOME].env.OPENAI_API_KEY = 'sk-openai'
    engine.profiles[HOME].usage = [
      row({ model: 'gpt-5', provider: 'custom', api_calls: 1 }),
      row({ model: 'gpt-5', provider: 'openai', input_tokens: 10, output_tokens: 0, api_calls: 1 })
    ]

    const models = withoutIds((await usage()).models)

    expect(models).toEqual([
      { model: 'gpt-5', provider: 'Custom', tokens: 1000, requests: 1 },
      { model: 'gpt-5', provider: 'OpenAI API', tokens: 10, requests: 1 }
    ])
  })

  it('should total every bot and break it down by model, most used first', async () => {
    engine.profiles[HOME].env.OPENAI_API_KEY = 'sk-openai'
    engine.profiles[HOME].usage = [
      row(),
      row({
        model: 'gpt-5',
        provider: 'openai',
        input_tokens: 3000,
        output_tokens: 0,
        api_calls: 5
      })
    ]
    engine.profiles.analyst.usage = [row({ input_tokens: 100, output_tokens: 0, api_calls: 1 })]

    const { models: all, total } = await usage()
    const models = withoutIds(all)

    expect(total).toEqual({ tokens: 4100, requests: 8 })
    expect(models).toEqual([
      { model: 'gpt-5', provider: 'OpenAI API', tokens: 3000, requests: 5 },
      { model: ROUTER.model, provider: 'Custom', tokens: 1100, requests: 3 }
    ])
  })

  describe('per provider', () => {
    it('should give each provider its own id and its models', async () => {
      engine.profiles[HOME].env.OPENAI_API_KEY = 'sk-openai'
      engine.profiles[HOME].usage = [
        row(),
        row({
          model: 'gpt-5',
          provider: 'openai',
          input_tokens: 10,
          output_tokens: 0,
          api_calls: 1
        })
      ]

      const { providers, models } = await usage()

      const ids = providers.map((item) => item.id)
      expect(new Set(ids).size).toBe(2)
      expect(models.filter((model) => model.providerId === ids[1])).toEqual([
        expect.objectContaining({ model: 'gpt-5', tokens: 10 })
      ])
    })

    it('should keep a provider id across periods', async () => {
      engine.profiles[HOME].usage = [row()]

      const [week, month] = [await usage(7), await usage(30)]

      expect(week.providers[0].id).toBe(month.providers[0].id)
    })
  })

  describe('per day', () => {
    const day = (patch: Partial<DailyRow>): DailyRow => ({
      day: '2026-11-15',
      provider: 'custom',
      input_tokens: 90,
      output_tokens: 10,
      api_calls: 1,
      ...patch
    })

    it("should add up every bot's days for all providers together", async () => {
      engine.profiles[HOME].daily = [day({}), day({ day: '2026-11-16', api_calls: 2 })]
      engine.profiles.analyst.daily = [day({ input_tokens: 0, output_tokens: 50 })]

      const { days } = await usage()

      expect(daysOf(days!, null)).toEqual([
        { day: '2026-11-15', tokens: 150, requests: 2 },
        { day: '2026-11-16', tokens: 100, requests: 2 }
      ])
    })

    it("should give each provider its own days, as its usage's owner", async () => {
      engine.profiles[HOME].env.OPENAI_API_KEY = 'sk-openai'
      engine.profiles[HOME].daily = [
        day({}),
        day({ provider: 'openai', input_tokens: 3, output_tokens: 0 }),
        day({ day: '2026-11-16', provider: 'custom:lab-retired' })
      ]

      const { days, providers } = await usage()
      const [router, openai] = providers

      expect(daysOf(days!, router.id)).toEqual([{ day: '2026-11-15', tokens: 100, requests: 1 }])
      expect(daysOf(days!, openai.id)).toEqual([{ day: '2026-11-15', tokens: 3, requests: 1 }])
      expect(daysOf(days!, null)).toHaveLength(2)
    })

    it('should leave out the days of a bot it could not read', async () => {
      engine.profiles[HOME].daily = [day({ input_tokens: 5, output_tokens: 5 })]
      engine.profiles.writer.usage = null
      engine.profiles.writer.daily = [day({})]

      const { days, unread } = await usage()

      expect(daysOf(days!, null)).toEqual([{ day: '2026-11-15', tokens: 10, requests: 1 }])
      expect(unread).toEqual(['writer'])
    })

    it('should keep the totals and say why when no day can be read', async () => {
      engine.profiles[HOME].usage = [row()]
      engine.daysFail = new Error('invalid choice: talyx-usage')

      const report = await usage()

      expect(report.days).toBeNull()
      expect(report.daysProblem).toEqual(engine.daysFail)
      expect(report.total).toEqual({ tokens: 1000, requests: 2 })
      expect(report.unread).toEqual([])
    })
  })

  describe('dailySeries', () => {
    it('should give every day of the period, the quiet ones as zero, oldest first', () => {
      const series = dailySeries([{ day: '2026-11-15', tokens: 7, requests: 1 }], {
        days: 3,
        today: new Date(2026, 10, 16, 9, 30)
      })

      expect(series).toEqual([
        { day: '2026-11-14', tokens: 0, requests: 0 },
        { day: '2026-11-15', tokens: 7, requests: 1 },
        { day: '2026-11-16', tokens: 0, requests: 0 }
      ])
    })

    it('should cross a month end', () => {
      const series = dailySeries([], { days: 2, today: new Date(2026, 11, 1) })

      expect(series.map((point) => point.day)).toEqual(['2026-11-30', '2026-12-01'])
    })
  })
})
