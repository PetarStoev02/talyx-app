import { pickHighest } from '../model/noticeRank'
import { dayStamp, NOTICE_KINDS, type Notice, type NoticeKind } from '../model/Notice'
import { isNoticesPaused } from '../model/noticePause'

export interface NoticeSettings {
  /** The master switch. Off on a fresh install: an app that interrupts before it is asked spends trust it has not earned. */
  noticesEnabled: boolean
  /** 'HH:MM' in the owner's own timezone. */
  briefingTime: string
  /** 'facts' assembles it for free; 'written' spends a model turn to have it narrated. */
  briefingStyle: 'facts' | 'written'
  noticeKinds: Record<NoticeKind, boolean>
}

export interface ProactiveSchedulerDeps {
  now(): Date
  settings(): NoticeSettings
  marks(): Record<string, string>
  saveMarks(marks: Record<string, string>): void
  briefing: { compose(): Promise<Notice | null> }
  watcher: {
    check(input: { kinds: NoticeKind[]; marks: Record<string, string> }): Promise<Notice[]>
  }
  deliver(notice: Notice): Promise<void>
  /** Hands the briefing to the model to narrate. Only used by the 'written' style. */
  speak(instruction: string): Promise<void>
  warn(message: string): void
  /** True while the assistant is mid-run or holding an approval — never talk over that. */
  busy(): boolean
  pausedUntil(): string | null
  savePausedUntil(value: string | null): void
}

/** One minute, the same beat the sort scheduler runs on. */
const CHECK_INTERVAL_MS = 60_000
/** What the model is asked when the owner wants the briefing in prose. */
const WRITTEN_INSTRUCTION = 'Brief me on my morning'
/**
 * How late a briefing may still arrive. A laptop asleep at eight is briefed the
 * moment it wakes; four hours on, "here is your day" is noise and it waits for
 * tomorrow. Measured from the chosen time, so an afternoon briefing works too.
 */
const LATE_GRACE_MINUTES = 4 * 60
const MINUTES_PER_DAY = 24 * 60

/**
 * Decides when Talyx speaks first. Producers say what is true; this says whether
 * it is worth an interruption, and remembers what was already said.
 */
export class ProactiveScheduler {
  private timer: ReturnType<typeof setInterval> | null = null
  private ticking = false

  constructor(private readonly deps: ProactiveSchedulerDeps) {}

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => void this.tick(), CHECK_INTERVAL_MS)
    void this.tick()
  }

  stop(): void {
    if (this.timer === null) return
    clearInterval(this.timer)
    this.timer = null
  }

  /** Runs the whole decision once. Public so Settings can preview it and tests can drive it. */
  async tick(): Promise<void> {
    const settings = this.deps.settings()
    const pausedUntil = this.deps.pausedUntil()
    const paused = isNoticesPaused(pausedUntil, this.deps.now())
    // Clear an expired pause even when the master switch is off, so Settings
    // does not keep showing a stale banner after midnight.
    if (pausedUntil !== null && !paused) {
      this.deps.savePausedUntil(null)
    }
    if (!settings.noticesEnabled || this.deps.busy() || this.ticking) return
    if (paused) return
    this.ticking = true
    try {
      await this.deliverBriefing(settings)
      await this.deliverNotices(settings)
    } finally {
      this.ticking = false
    }
  }

  /**
   * The Settings preview: compose and deliver regardless of the clock or the
   * marks. False when there was nothing to report, so the button can say so
   * rather than looking broken — which is exactly what a fresh Mac, before
   * Calendar and Mail automation are granted, will hit.
   */
  async briefNow(): Promise<boolean> {
    const notice = await this.deps.briefing.compose()
    if (notice === null) return false
    await this.deps.deliver(notice)
    return true
  }

  private async deliverBriefing(settings: NoticeSettings): Promise<void> {
    if (!settings.noticeKinds.briefing || !this.briefingIsDue(settings.briefingTime)) return

    const notice = await this.produce(() => this.deps.briefing.compose(), null)
    // A morning with nothing to say is still a morning that has been handled;
    // marking it stops the same empty question every minute until the grace
    // period runs out.
    if (notice === null) {
      this.mark('briefing', dayStamp(this.deps.now()))
      return
    }
    // Marked only once it is actually on screen, so a notification that failed
    // is tried again on the next tick rather than lost for the day.
    if (!(await this.attempt(() => this.deps.deliver(notice)))) return
    this.mark('briefing', notice.fingerprint)
    // Prose is a bonus on top of the facts, which are already on screen. No
    // Claude connected, or one that refuses, must not cost the owner the
    // briefing they would have had for free.
    if (settings.briefingStyle === 'written') {
      await this.attempt(() => this.deps.speak(WRITTEN_INSTRUCTION))
    }
  }

  /** Late is fine, stale is not. */
  private briefingIsDue(briefingTime: string): boolean {
    const now = this.deps.now()
    if (this.deps.marks()['briefing'] === dayStamp(now)) return false
    const [hours, minutes] = briefingTime.split(':').map(Number)
    // Wrapped, so a briefing chosen for 23:00 is still due at one in the
    // morning rather than counted as fourteen hours early.
    const sinceChosen = now.getHours() * 60 + now.getMinutes() - (hours * 60 + minutes)
    const lateByMinutes = ((sinceChosen % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
    return lateByMinutes <= LATE_GRACE_MINUTES
  }

  private async deliverNotices(settings: NoticeSettings): Promise<void> {
    const kinds = NOTICE_KINDS.filter((k) => k !== 'briefing' && settings.noticeKinds[k])
    if (kinds.length === 0) return

    const marks = this.deps.marks()
    const notices = await this.produce(() => this.deps.watcher.check({ kinds, marks }), [])
    const notice = pickHighest(notices.filter((n) => this.deps.marks()[n.kind] !== n.fingerprint))
    if (notice === null) return
    // Re-checked: a written briefing in the same tick starts a run, and pushing
    // a warning into the middle of one is how a reply gets lost.
    if (this.deps.busy()) return
    if (await this.attempt(() => this.deps.deliver(notice))) {
      this.mark(notice.kind, notice.fingerprint)
    }
  }

  /** A producer that could not answer costs this tick its notices, never the timer. */
  private async produce<T>(ask: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await ask()
    } catch (err) {
      this.deps.warn(`[notices] ${(err as Error).message}`)
      return fallback
    }
  }

  /** One notice that could not be shown must not stop the next tick, or the next notice. */
  private attempt(action: () => Promise<void>): Promise<boolean> {
    return this.produce(async () => {
      await action()
      return true
    }, false)
  }

  private mark(kind: NoticeKind, fingerprint: string): void {
    this.deps.saveMarks({ ...this.deps.marks(), [kind]: fingerprint })
  }
}
