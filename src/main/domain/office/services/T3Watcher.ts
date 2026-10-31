import type { T3Cli, T3Thread } from '../../../infrastructure/office/T3Cli'
import type { RosterRepo } from '../repository/RosterRepo'
import type { SignalRepo } from '../repository/SignalRepo'
import type { RecordSignal } from '../useCases/RecordSignal'
import type { T3Status } from '../model'

export interface T3WatcherDeps {
  cli: T3Cli
  roster: RosterRepo
  signals: SignalRepo
  record: RecordSignal
  now: () => Date
}

export class T3Watcher {
  private readonly last = new Map<string, T3Status>()
  private readonly finished = new Set<string>()
  private timer: NodeJS.Timeout | null = null
  private busy = false
  private ok = true

  constructor(private readonly deps: T3WatcherDeps) {}

  connected(): boolean {
    return this.ok
  }

  start(intervalMs: number): void {
    this.stop()
    this.timer = setInterval(() => {
      if (this.busy) return
      this.busy = true
      void this.tick().finally(() => (this.busy = false))
    }, intervalMs)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  async tick(): Promise<void> {
    const bots = this.deps.roster.allBots()
    const projectIds = [...new Set(bots.flatMap((b) => b.t3ProjectIds))]
    const threads = new Map<string, T3Thread>()
    try {
      for (const pid of projectIds) {
        for (const t of await this.deps.cli.listThreads(pid)) threads.set(t.threadId, t)
      }
    } catch (err) {
      this.fail(err)
      return
    }
    this.ok = true
    for (const id of this.deps.signals.ownedThreadIds()) {
      if (threads.has(id) || this.finished.has(id)) continue
      const t = await this.show(id)
      if (t) threads.set(id, t)
    }
    for (const t of threads.values()) {
      const owner =
        this.deps.signals.threadOwner(t.threadId) ??
        bots.find((b) => b.t3ProjectIds.includes(t.projectId))?.id
      if (owner) await this.observe(t, owner)
    }
  }

  private async observe(listed: T3Thread, owner: string): Promise<void> {
    let thread = listed
    if (listed.status === 'running') {
      const detail = await this.show(listed.threadId)
      if (!detail) return
      thread = detail
    }
    const status = toStatus(thread)
    // Unseen threads start from 'done' so the first tick only reports live work.
    if (status === (this.last.get(thread.threadId) ?? 'done')) return
    try {
      this.deps.record.execute({
        kind: 't3',
        botId: owner,
        t3ThreadId: thread.threadId,
        title: thread.title,
        status,
        link: thread.link,
        at: this.deps.now().toISOString()
      })
    } catch (err) {
      console.warn(`T3Watcher: ${errorLine(err)}`)
      return
    }
    this.last.set(thread.threadId, status)
    if (status === 'done') this.finished.add(thread.threadId)
  }

  private async show(threadId: string): Promise<T3Thread | null> {
    try {
      return await this.deps.cli.showThread(threadId)
    } catch (err) {
      console.warn(`T3Watcher: ${errorLine(err)}`)
      return null
    }
  }

  private fail(err: unknown): void {
    this.ok = false
    console.warn(`T3Watcher: ${errorLine(err)}`)
  }
}

const toStatus = (t: T3Thread): T3Status =>
  t.status !== 'running' ? 'done' : t.pendingRequestCount > 0 ? 'waiting' : 'running'

const errorLine = (err: unknown): string =>
  err instanceof Error ? `${err.constructor.name}: ${err.message}` : 'unknown error'
