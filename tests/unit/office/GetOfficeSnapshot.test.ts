import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../../../src/main/infrastructure/database/migrations'
import { RosterRepo } from '../../../src/main/domain/office/repository/RosterRepo'
import { SignalRepo } from '../../../src/main/domain/office/repository/SignalRepo'
import { seedAgroOps } from '../../../src/main/domain/office/seedAgroOps'
import { GetOfficeSnapshot } from '../../../src/main/domain/office/useCases/GetOfficeSnapshot'
import type { BotSignal } from '../../../src/main/domain/office/model'

const NOW = new Date('2026-01-01T10:05:00.000Z')
const CTO = 'agro-ops-cto'
const SALES = 'agro-ops-sales'

function setup(keys: Record<string, string> = {}): {
  uc: GetOfficeSnapshot
  roster: RosterRepo
  signals: SignalRepo
} {
  const db = new Database(':memory:')
  runMigrations(db)
  const roster = new RosterRepo(db)
  const signals = new SignalRepo(db)
  seedAgroOps(roster)
  const uc = new GetOfficeSnapshot({
    roster,
    signals,
    secrets: { get: (name) => keys[name] ?? null },
    staleMinutes: () => 15,
    t3Connected: () => true,
    funnel: () => ({ on: true, url: 'https://mac.ts.net' }),
    now: () => NOW
  })
  return { uc, roster, signals }
}

const at = (minute: number): string => `2026-01-01T10:0${minute}:00.000Z`

describe('GetOfficeSnapshot', () => {
  it('builds rooms with layout boxes and bots with placements', () => {
    const { uc, signals } = setup()
    signals.append({ kind: 'chat', botId: CTO, groupId: 'agro-ops-team', text: 'hi', at: at(1) })

    const s = uc.execute('agro-ops')

    expect(s.project.name).toBe('AgroOps')
    expect(s.projects.map((p) => p.id)).toEqual(['agro-ops'])
    expect(s.groups).toHaveLength(2)
    expect(s.t3Connected).toBe(true)
    expect(s.funnel).toEqual({ on: true, url: 'https://mac.ts.net' })
    const team = s.rooms.find((r) => r.id === 'agro-ops-team-room')
    expect(team).toMatchObject({ name: 'Team conference', roomId: team?.id, z: 0, w: 6, d: 5 })
    expect(s.rooms).toHaveLength(4)
    expect(s.bots).toHaveLength(11)
    const cto = s.bots.find((b) => b.id === CTO)
    expect(cto?.placement).toMatchObject({ roomId: 'agro-ops-team-room', lastLine: 'hi' })
    expect(s.bots.find((b) => b.id === SALES)?.placement.roomId).toBe('agro-ops-chill')
  })

  it('writes readable feed lines newest first', () => {
    const { uc, signals } = setup()
    const feed: BotSignal[] = [
      { kind: 'chat', botId: CTO, groupId: 'agro-ops-team', text: 'hello', at: at(0) },
      { kind: 'task', botId: CTO, task: 'ship it', t3ThreadId: null, runId: 'r', at: at(1) },
      { kind: 'idle', botId: CTO, at: at(1) },
      { kind: 'result', botId: CTO, runId: 'r', text: 'shipped', at: at(2) },
      { kind: 'task-failed', botId: SALES, runId: null, reason: 'timeout', at: at(3) },
      {
        kind: 't3',
        botId: CTO,
        t3ThreadId: 't1',
        title: 'Fix login',
        status: 'running',
        link: null,
        at: at(4)
      },
      {
        kind: 't3',
        botId: CTO,
        t3ThreadId: 't1',
        title: 'Fix login',
        status: 'waiting',
        link: null,
        at: at(5)
      },
      { kind: 'message', botId: SALES, toBotId: CTO, text: 'ping', at: at(6) }
    ]
    feed.forEach((f) => signals.append(f))

    expect(uc.execute('agro-ops').feed).toEqual([
      { botId: SALES, text: '→ CTO: ping', at: at(6) },
      { botId: CTO, text: 'Waiting for you in T3: Fix login', at: at(5) },
      { botId: CTO, text: 'T3: Fix login', at: at(4) },
      { botId: SALES, text: 'Task failed: timeout', at: at(3) },
      { botId: CTO, text: 'Done: shipped', at: at(2) },
      { botId: CTO, text: 'Started: ship it', at: at(1) },
      { botId: CTO, text: 'hello', at: at(0) }
    ])
  })

  it('marks webhookReady only when url and key exist', () => {
    const { uc, roster } = setup({ [`webhook-key:${CTO}`]: 'k1', [`webhook-key:${SALES}`]: 'k2' })
    const bots = roster.listBots('agro-ops')
    const withUrl = (id: string): void =>
      roster.saveBot({ ...bots.find((b) => b.id === id)!, webhookUrl: 'https://hook.example' })
    withUrl(CTO)
    withUrl('agro-ops-cfo')

    const ready = uc
      .execute('agro-ops')
      .bots.filter((b) => b.webhookReady)
      .map((b) => b.id)

    expect(ready).toEqual([CTO])
  })
})
