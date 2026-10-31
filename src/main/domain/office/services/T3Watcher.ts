import type { T3Cli, T3Thread } from '../../../infrastructure/office/T3Cli'
import type { RosterRepo } from '../repository/RosterRepo'
import type { SignalRepo } from '../repository/SignalRepo'
import type { RecordSignal } from '../useCases/RecordSignal'
import type { T3Status } from '../model'

// A running thread missing from T3 this many good ticks in a row is treated as gone.
const VANISHED_TICKS = 3

export interface T3WatcherDeps {
  cli: T3Cli
  roster: RosterRepo
  signals: SignalRepo
  record: RecordSignal
  now: () => Date
}

export class T3Watcher {
  private last: Map<string, T3Status> | null = null
  private readonly warned = new Set<string>()
  private readonly finished = new Set<string>()
  private readonly misses = new Map<string, number>()
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
      this.tick()
        .catch((err) => this.warnOnce('tick', err))
        .finally(() => (this.busy = false))
    }, intervalMs)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  async tick(): Promise<void> {
    // Restart-safe: resume from what was last recorded, not from nothing.
    this.last ??= this.deps.signals.latestT3Statuses()
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
    this.warned.delete('list')
    const reported = new Set(this.deps.signals.ownedThreadIds())
    for (const id of reported) {
      if (threads.has(id) || this.finished.has(id)) continue
      const t = await this.show(id)
      if (t) threads.set(id, t)
    }
    for (const t of threads.values()) {
      const owner =
        this.deps.signals.threadOwner(t.threadId) ??
        bots.find((b) => b.t3ProjectIds.includes(t.projectId))?.id
      if (owner) await this.observe(t, owner, reported.has(t.threadId))
    }
    this.retireVanished(threads)
  }

  /** A running thread T3 no longer knows would otherwise hold its bot at a computer for days. */
  private retireVanished(found: Map<string, T3Thread>): void {
    for (const [threadId, status] of this.last ?? []) {
      if (status === 'done' || found.has(threadId)) {
        this.misses.delete(threadId)
        continue
      }
      const misses = (this.misses.get(threadId) ?? 0) + 1
      this.misses.set(threadId, misses)
      if (misses < VANISHED_TICKS) continue
      const owner = this.deps.signals.threadOwner(threadId)
      if (!owner) continue
      this.finished.add(threadId)
      this.recordStatus({ threadId, title: '', link: null }, owner, 'done')
    }
  }

  private async observe(listed: T3Thread, owner: string, reported: boolean): Promise<void> {
    let thread = listed
    if (listed.status === 'running') {
      const detail = await this.show(listed.threadId)
      if (!detail) return
      thread = detail
    }
    const status = toStatus(thread)
    if (status === 'done') this.finished.add(thread.threadId)
    // Unseen project threads start from 'done' so old history is not replayed; a thread
    // a bot reported is expected, so even a fast one that is already done records once.
    const seen = this.last?.get(thread.threadId) ?? (reported ? null : 'done')
    if (status === seen) return
    this.recordStatus(thread, owner, status)
  }

  private recordStatus(
    thread: Pick<T3Thread, 'threadId' | 'title' | 'link'>,
    owner: string,
    status: T3Status
  ): void {
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
      this.warnOnce(`record:${thread.threadId}`, err)
      return
    }
    this.warned.delete(`record:${thread.threadId}`)
    this.last?.set(thread.threadId, status)
  }

  private async show(threadId: string): Promise<T3Thread | null> {
    try {
      const t = await this.deps.cli.showThread(threadId)
      this.warned.delete(`show:${threadId}`)
      return t
    } catch (err) {
      this.warnOnce(`show:${threadId}`, err)
      return null
    }
  }

  private fail(err: unknown): void {
    this.ok = false
    this.warnOnce('list', err)
  }

  private warnOnce(key: string, err: unknown): void {
    if (this.warned.has(key)) return
    this.warned.add(key)
    console.warn(`T3Watcher: ${errorLine(err)}`)
  }
}

const toStatus = (t: T3Thread): T3Status =>
  t.status !== 'running' ? 'done' : t.pendingRequestCount > 0 ? 'waiting' : 'running'

const errorLine = (err: unknown): string =>
  err instanceof Error ? `${err.constructor.name}: ${err.message}` : 'unknown error'
