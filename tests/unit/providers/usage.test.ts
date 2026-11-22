import { beforeEach, describe, expect, it } from 'vitest'
import { loadProviders } from '../../../src/renderer/src/features/providers/providers'
import {
  USAGE_PERIODS,
  dailySeries,
  daysOf,
  loadUsage,
  usageOver
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

  it('should load providers then usage for the period', async () => {
    engine.profiles[HOME].usage = [row()]
    const direct = await usage(30)
    const over = await usageOver(engine.backend, 30)
    expect(over).toEqual(direct)
  })

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

  describe('an endpoint the engine billed as custom, by its base URL', () => {
    const NINE = 'http://localhost:20128/v1'
    const named = (
      id: string,
      baseUrl: string
    ): (typeof engine.profiles)[string]['endpoints'][number] => ({
      ...ROUTER,
      id,
      name: id,
      base_url: baseUrl,
      is_current: false,
      source: 'providers'
    })
    const billed = (patch: Partial<DailyRow>): DailyRow => ({
      day: '2026-11-15',
      model: 'm',
      provider: 'custom',
      base_url: NINE,
      input_tokens: 90,
      output_tokens: 10,
      api_calls: 1,
      ...patch
    })

    it('should show its usage under the endpoint, with no custom row', async () => {
      engine.profiles[HOME].endpoints.push(named('nine-router', NINE))
      engine.profiles[HOME].daily = [
        billed({ model: '9-route-provider' }),
        billed({ model: 'gpt-6-sol', base_url: `${NINE}/`, api_calls: 2 })
      ]

      const { providers, models } = await usage()

      expect(withoutIds(providers)).toEqual([
        { name: 'Custom', usage: null },
        { name: 'nine-router', usage: { tokens: 200, requests: 3 } }
      ])
      expect(withoutIds(models).map((model) => [model.model, model.provider])).toEqual([
        ['gpt-6-sol', 'nine-router'],
        ['9-route-provider', 'nine-router']
      ])
    })

    it('should give two endpoints on different URLs each its own usage', async () => {
      engine.profiles[HOME].endpoints.push(named('nine-router', NINE))
      engine.profiles[HOME].endpoints.push(named('lab', 'http://10.0.0.2:8000/v1'))
      engine.profiles[HOME].daily = [
        billed({}),
        billed({ base_url: 'http://10.0.0.2:8000/v1', input_tokens: 5, output_tokens: 5 })
      ]

      const providers = withoutIds((await usage()).providers)

      expect(providers).toEqual([
        { name: 'Custom', usage: null },
        { name: 'nine-router', usage: { tokens: 100, requests: 1 } },
        { name: 'lab', usage: { tokens: 10, requests: 1 } }
      ])
    })

    it('should list usage on a URL no endpoint has as custom, its own row', async () => {
      engine.profiles[HOME].endpoints.push(named('nine-router', NINE))
      engine.profiles[HOME].daily = [billed({ base_url: 'http://10.9.9.9/v1' })]

      const providers = withoutIds((await usage()).providers)

      expect(providers).toEqual([
        { name: 'Custom', usage: null },
        { name: 'nine-router', usage: null },
        { name: 'custom', usage: { tokens: 100, requests: 1 } }
      ])
    })
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
      model: ROUTER.model,
      provider: 'custom',
      base_url: '',
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

    it("should keep a bot's totals when only its days cannot be read, and name it", async () => {
      engine.profiles[HOME].usage = [row()]
      engine.profiles[HOME].daily = [day({ input_tokens: 900, output_tokens: 100, api_calls: 2 })]
      engine.profiles.writer.usage = [row({ input_tokens: 40, output_tokens: 0, api_calls: 1 })]
      engine.profiles.writer.daily = null

      const report = await usage()

      expect(report.total).toEqual({ tokens: 1040, requests: 3 })
      expect(daysOf(report.days!, null)).toEqual([{ day: '2026-11-15', tokens: 1000, requests: 2 }])
      expect(report.unread).toEqual([])
      expect(report.daysUnread).toEqual(['writer'])
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
    // The period reaches back `days` times 24 hours, so it touches one more date than that.
    it('should give every date the period touches, the quiet ones as zero, oldest first', () => {
      const series = dailySeries([{ day: '2026-11-13', tokens: 7, requests: 1 }], {
        days: 3,
        today: new Date(2026, 10, 16, 15, 0)
      })

      expect(series).toEqual([
        { day: '2026-11-13', tokens: 7, requests: 1 },
        { day: '2026-11-14', tokens: 0, requests: 0 },
        { day: '2026-11-15', tokens: 0, requests: 0 },
        { day: '2026-11-16', tokens: 0, requests: 0 }
      ])
    })

    it('should cross a month end', () => {
      const series = dailySeries([], { days: 2, today: new Date(2026, 11, 1) })

      expect(series.map((point) => point.day)).toEqual(['2026-11-29', '2026-11-30', '2026-12-01'])
    })

    it('should start on the date the period does when the clocks went forward in it', () => {
      const zone = process.env.TZ
      process.env.TZ = 'Europe/Sofia'
      try {
        // Spring forward on March 29: seven 24-hour days back from 00:30 is March 22 23:30.
        const series = dailySeries([{ day: '2026-03-22', tokens: 123, requests: 1 }], {
          days: 7,
          today: new Date(2026, 2, 30, 0, 30)
        })

        expect(series[0]).toEqual({ day: '2026-03-22', tokens: 123, requests: 1 })
        expect(series.at(-1)?.day).toBe('2026-03-30')
      } finally {
        process.env.TZ = zone
      }
    })

    it('should count calendar dates across a clock change, not 24-hour steps', () => {
      // Late October: most of Europe falls back an hour, a 25-hour day.
      const series = dailySeries([], { days: 7, today: new Date(2026, 10, 1, 0, 30) })

      expect(series.map((point) => point.day)).toEqual([
        '2026-10-25',
        '2026-10-26',
        '2026-10-27',
        '2026-10-28',
        '2026-10-29',
        '2026-10-30',
        '2026-10-31',
        '2026-11-01'
      ])
    })
  })
})
