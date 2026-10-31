export interface SetFunnelDeps {
  enable: () => Promise<void>
  disable: () => Promise<void>
  /** Persists whether Funnel should be on at the next launch. */
  saveEnabled: (on: boolean) => void
  /** Re-reads the real Funnel state after any change. */
  refresh: () => Promise<void>
}

/**
 * Turns the public Funnel URL on or off. "On" is remembered only once enabling worked, so a
 * refused enable never comes back on by itself later (e.g. after an admin approves Funnel).
 */
export class SetFunnel {
  constructor(private readonly deps: SetFunnelDeps) {}

  async execute(on: boolean): Promise<void> {
    try {
      if (on) await this.turnOn()
      else await this.turnOff()
    } finally {
      await this.deps.refresh()
    }
  }

  private async turnOn(): Promise<void> {
    try {
      await this.deps.enable()
    } catch (err) {
      this.deps.saveEnabled(false)
      throw err
    }
    this.deps.saveEnabled(true)
  }

  private async turnOff(): Promise<void> {
    this.deps.saveEnabled(false)
    await this.deps.disable()
  }
}
