import {
  BARE_CUSTOM,
  CONFIG_YAML_SOURCE,
  namedTwinOfBare,
  sameBaseUrl
} from '@shared/engine/endpoints'
import { loadProviders } from './providers'
import type {
  Billed,
  BilledDay,
  DayUsage,
  ModelUsage,
  ProvidersBackend,
  ProvidersOverview
} from './providers'
import { CLOCK_DIGITS, DAY_MS } from '@shared/lib/time'

const WEEK_DAYS = 7
const MONTH_DAYS = 30
const QUARTER_DAYS = 90
/** The periods, in days, the Usage page offers. */
export const USAGE_PERIODS = [WEEK_DAYS, MONTH_DAYS, QUARTER_DAYS] as const
export type UsagePeriod = (typeof USAGE_PERIODS)[number]

type Counts = { tokens: number; requests: number }

export interface UsageReport {
  providers: ProviderUsage[]
  /** Every model that reported usage, most tokens first. */
  models: ModelBreakdown[]
  /** Every provider's usage per local day; days with none are left out. Null: `daysProblem`. */
  days: ProviderDay[] | null
  /** Why no bot's days could be read; the totals still stand. */
  daysProblem: unknown
  /** Bots whose days alone could not be read: their totals count, their days are left out. */
  daysUnread: string[]
  total: Counts
  /** Bots whose usage could not be read; the totals leave them out. */
  unread: string[]
}

export interface ProviderUsage {
  /** Stable across periods, for picking the provider on the page. */
  id: string
  /** As Settings lists the provider, else as the engine recorded it; null when it recorded none. */
  name: string | null
  /** Null when the provider reported nothing in the period: no tokens and no requests. */
  usage: Counts | null
}

export interface ModelBreakdown extends Counts {
  model: string
  /** The provider's `id` and name, as in `providers`. */
  providerId: string
  provider: string | null
}

export interface ProviderDay extends DayUsage {
  /** The provider's `id`, as in `providers`. */
  providerId: string
}

interface Owner {
  id: string
  name: string | null
  owns: (row: Billed) => boolean
}

type Backend = Pick<ProvidersBackend, 'home' | 'profiles' | 'endpoints' | 'usage' | 'dailyUsage'>

/** The report for the last `days`, with the providers as Settings lists them now. */
export async function usageOver(backend: ProvidersBackend, days: number): Promise<UsageReport> {
  const overview = await loadProviders(backend)
  return loadUsage(backend, { overview, days })
}

/**
 * Each provider's usage over the last `days`, summed over every bot. The providers Settings lists
 * come first, in its order, each with its usage or none; then any other provider a bot used.
 */
export async function loadUsage(
  backend: Backend,
  request: { overview: ProvidersOverview; days: number }
): Promise<UsageReport> {
  const [bots, endpoints] = await Promise.all([
    readBots(backend, request.days),
    backend.endpoints(backend.home)
  ])
  // Settings hides Talyx's named copy of the active endpoint; a bot on that copy is billed under it.
  const ownerOf = owning(listedProviders(request.overview, namedTwinOfBare(endpoints)?.id ?? null))
  const { providers, models } = attribute(ownerOf, bots.rows)
  return {
    providers,
    models,
    days: bots.days && sumDays(bots.days.map((day) => ({ ...day, providerId: ownerOf(day).id }))),
    daysProblem: bots.daysProblem,
    daysUnread: bots.daysUnread,
    total: models.reduce((sum, model) => add(sum, model) ?? sum, ZERO),
    unread: bots.unread
  }
}

/** Usage per day for one provider's `id`, or every provider's for null; days with none left out. */
export function daysOf(days: ProviderDay[], providerId: string | null): DayUsage[] {
  const picked = days.filter((day) => providerId === null || day.providerId === providerId)
  return sumDays(picked.map((day) => ({ ...day, providerId: '' }))).map(
    ({ day, tokens, requests }) => ({ day, tokens, requests })
  )
}

/**
 * Every local date the last `days` touch up to `today`, oldest first; a day with no usage is zero,
 * so a chart shows the quiet days too. The period reaches back `days` times 24 hours, as the
 * engine's own does, so it starts partway through the date `days` before today.
 */
export function dailySeries(daily: DayUsage[], period: { days: number; today: Date }): DayUsage[] {
  const byDay = new Map(daily.map((point) => [point.day, point]))
  // The engine's cutoff, in real time; its date can be one more or fewer calendar steps back
  // than `days` when the clocks changed in between.
  const date = new Date(period.today.getTime() - period.days * DAY_MS)
  const last = localDay(period.today)
  const series: DayUsage[] = []
  for (let day = localDay(date); ; day = localDay(date)) {
    series.push(byDay.get(day) ?? { day, ...ZERO })
    if (day >= last) return series
    date.setDate(date.getDate() + 1)
  }
}

const ZERO: Counts = { tokens: 0, requests: 0 }

// A bot whose totals cannot be read is left out; one whose days alone cannot be read keeps its
// totals and is left out of the days. When no day can be read at all, the totals stand alone.
// A bot's totals are its days summed when they were read: the engine's per-model totals follow the
// same rules but leave out the base URL, the only thing that tells two custom endpoints apart.
async function readBots(
  backend: Backend,
  days: number
): Promise<{
  rows: ModelUsage[]
  days: BilledDay[] | null
  daysProblem: unknown
  daysUnread: string[]
  unread: string[]
}> {
  const profiles = await backend.profiles()
  const [models, perDay] = await Promise.all([
    Promise.all(
      profiles.map((profile) =>
        backend.usage(profile, days).then(
          (rows) => ({ profile, rows }),
          () => ({ profile, rows: null })
        )
      )
    ),
    backend.dailyUsage(profiles, days).then(
      (read) => ({ read, problem: null }),
      (problem: unknown) => ({ read: null, problem })
    )
  ])
  const unread = models.flatMap((model) => (model.rows ? [] : [model.profile]))
  const read = profiles.filter((profile) => !unread.includes(profile))
  const dayless = perDay.read ? read.filter((profile) => !perDay.read?.[profile]) : []
  return {
    rows: models.flatMap(({ profile, rows }) => (rows ? (perDay.read?.[profile] ?? rows) : [])),
    days: perDay.read && read.flatMap((profile) => perDay.read?.[profile] ?? []),
    daysProblem: perDay.problem,
    daysUnread: dayless,
    unread
  }
}

// Each usage to the provider that owns it; one it does not list gets an owner of its own.
function owning(owners: Owner[]): ((row: Billed) => Owner) & { listed: Owner[] } {
  const others = new Map<string, Owner>()
  const ownerOf = (row: Billed): Owner =>
    owners.find((item) => item.owns(row)) ?? otherOwner(others, row)
  return Object.assign(ownerOf, { listed: owners })
}

// Each row to its provider; by provider, then model, so two providers serving one model are two rows.
function attribute(
  ownerOf: ReturnType<typeof owning>,
  rows: ModelUsage[]
): Pick<UsageReport, 'providers' | 'models'> {
  const owners = ownerOf.listed
  const sums = new Map<Owner, ProviderUsage['usage']>(owners.map((owner) => [owner, null]))
  const models = new Map<Owner, Map<string, ModelBreakdown>>()
  for (const row of rows) {
    const owner = ownerOf(row)
    sums.set(owner, add(sums.get(owner) ?? null, row))
    const ofOwner = models.get(owner) ?? new Map<string, ModelBreakdown>()
    const model = ofOwner.get(row.model) ?? {
      model: row.model,
      providerId: owner.id,
      provider: owner.name,
      ...ZERO
    }
    models.set(owner, ofOwner.set(row.model, { ...model, ...add(model, row) }))
  }
  return {
    providers: [...sums]
      .filter(([owner, usage]) => usage || owners.includes(owner))
      .map(([owner, usage]) => ({ id: owner.id, name: owner.name, usage })),
    models: [...models.values()]
      .flatMap((ofOwner) => [...ofOwner.values()])
      .filter((model) => model.tokens || model.requests)
      .sort((a, b) => b.tokens - a.tokens || b.requests - a.requests)
  }
}

// One entry per provider and day, oldest first.
function sumDays(days: ProviderDay[]): ProviderDay[] {
  const byDay = new Map<string, ProviderDay>()
  for (const point of days) {
    const key = `${point.providerId}\n${point.day}`
    const sum = byDay.get(key) ?? { day: point.day, providerId: point.providerId, ...ZERO }
    byDay.set(key, { ...sum, ...(add(sum, point) ?? ZERO) })
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day))
}

// One owner per provider: one with a key and a sign-in, or two sign-ins, shows under the first.
function listedProviders(overview: ProvidersOverview, twin: string | null): Owner[] {
  const endpoints = overview.endpoints.map((endpoint): Owner => {
    // A row with no base URL names its endpoint: by id, or by name lowercased with dashes.
    const ids = [endpoint.id, endpoint.name.toLowerCase().replace(/ /g, '-')]
    if (twin && endpoint.source === CONFIG_YAML_SOURCE) ids.push(twin)
    return {
      id: `endpoint:${endpoint.id}`,
      name: endpoint.name,
      owns: (row) =>
        row.endpoint === BARE_CUSTOM && row.baseUrl !== null
          ? sameBaseUrl(row.baseUrl, endpoint.base_url)
          : row.endpoint !== null && ids.includes(row.endpoint)
    }
  })
  const byProvider = new Map<string, Owner>()
  for (const { name, providerId } of [
    ...overview.keys
      .filter((slot) => slot.preview)
      .map((slot) => ({ ...slot, name: slot.provider })),
    ...overview.accounts.filter((account) => account.signedIn)
  ]) {
    if (!byProvider.has(providerId)) byProvider.set(providerId, byId(name, providerId))
  }
  return [...endpoints, ...byProvider.values()]
}

function byId(name: string, id: string): Owner {
  return { id: `provider:${id}`, name, owns: (row) => row.provider === id }
}

// A provider or endpoint Settings does not list, named as the engine recorded it.
function otherOwner(others: Map<string, Owner>, row: Billed): Owner {
  const name = row.provider ?? row.endpoint
  const id = `other:${row.provider === null ? 'endpoint' : 'provider'}:${name ?? ''}`
  const owner = others.get(id) ?? { id, name, owns: () => false }
  others.set(id, owner)
  return owner
}

// Zero tokens and zero requests is no report, not a usage of zero.
function add(sum: Counts | null, row: Counts): Counts | null {
  if (row.tokens === 0 && row.requests === 0) return sum
  return { tokens: (sum?.tokens ?? 0) + row.tokens, requests: (sum?.requests ?? 0) + row.requests }
}

function localDay(date: Date): string {
  const pad = (value: number): string => String(value).padStart(CLOCK_DIGITS, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
