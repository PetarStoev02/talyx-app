import { z } from 'zod/v4'
import type { Capability, Proposal } from '../model/Capability'
import type { Effect } from '../model/Effect'

export interface SystemCapabilityDeps {
  freeSpace(path: string): Promise<{ freeBytes: number; totalBytes: number }>
  setDarkMode(on: boolean): Promise<void>
  setWifi(on: boolean): Promise<void>
  setMuted(on: boolean): Promise<void>
  /** Output volume, 0–100. */
  volume(): Promise<number>
  setVolume(percent: number): Promise<void>
}

export type ToggleSetting = 'dark_mode' | 'wifi' | 'mute'
export type TogglePayload = { setting: ToggleSetting; on: boolean }
export type VolumePayload = { percent: number }

const READ_ONLY: Effect = { reversible: false, world: 'reads', discloses: 'nothing' }
/** A toggle flipped back is exactly undone; a volume put back to its old level too. */
const REVERSIBLE_MUTATION: Effect = { reversible: true, world: 'mutates', discloses: 'nothing' }

const TOGGLE_LABELS: Record<ToggleSetting, (on: boolean) => string> = {
  dark_mode: (on) => `Turn dark mode ${on ? 'on' : 'off'}`,
  wifi: (on) => `Turn Wi‑Fi ${on ? 'on' : 'off'}`,
  mute: (on) => (on ? 'Mute the sound' : 'Unmute the sound')
}

/** Below this, "how much space have I got" deserves an answer with a warning in it. */
export const NEARLY_FULL_RATIO = 0.1

function gigabytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024 * 1024))} GB`
}

export function systemCapabilities(deps: SystemCapabilityDeps): Capability[] {
  const diskSpace: Capability<Record<string, never>> = {
    name: 'disk_space',
    description: 'Report how much free storage is left on the disk',
    examples: ['how much space do I have left', 'is my disk full', 'am I running out of storage'],
    params: z.object({}),
    effect: READ_ONLY,
    async plan(_params, ctx): Promise<Proposal> {
      const { freeBytes, totalBytes } = await deps.freeSpace(ctx.home)
      const nearlyFull = freeBytes / totalBytes < NEARLY_FULL_RATIO

      return {
        kind: 'answer',
        summary: nearlyFull
          ? `${gigabytes(freeBytes)} free of ${gigabytes(totalBytes)} — the disk is nearly full`
          : `${gigabytes(freeBytes)} free of ${gigabytes(totalBytes)}`,
        evidence: [],
        card: { kind: 'disk', freeBytes, totalBytes }
      }
    }
  }

  const applyToggle = ({ setting, on }: TogglePayload): Promise<void> =>
    setting === 'dark_mode'
      ? deps.setDarkMode(on)
      : setting === 'wifi'
        ? deps.setWifi(on)
        : deps.setMuted(on)

  const systemToggle: Capability<TogglePayload> = {
    name: 'system_toggle',
    description: 'Turn dark mode, Wi‑Fi or mute on or off',
    examples: ['turn on dark mode', 'turn off wifi', 'mute my mac', 'unmute'],
    params: z.object({
      setting: z.enum(['dark_mode', 'wifi', 'mute']).describe('Which setting'),
      on: z.boolean().describe('true to turn it on, false to turn it off')
    }),
    effect: REVERSIBLE_MUTATION,
    async plan({ setting, on }): Promise<Proposal> {
      return {
        kind: 'plan',
        summary: TOGGLE_LABELS[setting](on),
        operations: [
          {
            label: TOGGLE_LABELS[setting](on),
            reason: 'setting',
            payload: { setting, on },
            inverse: { setting, on: !on }
          }
        ]
      }
    },
    async execute(op) {
      await applyToggle(op.payload as TogglePayload)
    },
    async revert(op) {
      await applyToggle(op.inverse as TogglePayload)
    }
  }

  const setVolume: Capability<VolumePayload> = {
    name: 'set_volume',
    description: 'Set the output volume as a percentage',
    examples: ['volume to 30 percent', 'turn the volume down to 20', 'max volume'],
    params: z.object({
      percent: z.number().int().min(0).max(100).describe('0 is silent, 100 is loudest')
    }),
    effect: REVERSIBLE_MUTATION,
    async plan({ percent }): Promise<Proposal> {
      const current = await deps.volume()
      return {
        kind: 'plan',
        summary: `Set the volume to ${percent}%`,
        operations: [
          {
            label: `Volume ${percent}% (now ${current}%)`,
            reason: 'volume',
            payload: { percent },
            inverse: { percent: current }
          }
        ]
      }
    },
    async execute(op) {
      await deps.setVolume((op.payload as VolumePayload).percent)
    },
    async revert(op) {
      await deps.setVolume((op.inverse as VolumePayload).percent)
    }
  }

  return [diskSpace as Capability, systemToggle as Capability, setVolume as Capability]
}
