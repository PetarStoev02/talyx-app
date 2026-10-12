import { describe, it, expect, vi } from 'vitest'
import { CapabilityRegistry } from '../../../../src/main/domain/instruction/model/CapabilityRegistry'
import {
  systemCapabilities,
  type SystemCapabilityDeps
} from '../../../../src/main/domain/instruction/capabilities/system'
import type { CapabilityContext } from '../../../../src/main/domain/instruction/model/Capability'

const ctx: CapabilityContext = {
  home: '/Users/test',
  projectsRoot: '/Users/test/Code',
  signal: new AbortController().signal,
  logger: { info: () => {}, warn: () => {} }
}

const GIGABYTE = 1024 * 1024 * 1024

function deps(freeBytes: number, totalBytes: number): SystemCapabilityDeps {
  return {
    freeSpace: async () => ({ freeBytes, totalBytes }),
    setDarkMode: vi.fn(async () => {}),
    setWifi: vi.fn(async () => {}),
    setMuted: vi.fn(async () => {}),
    volume: async () => 65,
    setVolume: vi.fn(async () => {})
  }
}

async function ask(
  freeBytes: number,
  totalBytes: number
): Promise<{ summary: string; card?: unknown }> {
  const registry = new CapabilityRegistry(systemCapabilities(deps(freeBytes, totalBytes)))
  const capability = registry.get('disk_space')!
  const proposal = await capability.plan(capability.params.parse({}), ctx)
  if (proposal.kind !== 'answer') throw new Error('expected an answer')
  return proposal
}

describe('disk_space', () => {
  it('should answer with free space in human units', async () => {
    const answer = await ask(250 * GIGABYTE, 500 * GIGABYTE)

    expect(answer.summary).toContain('250 GB')
    expect(answer.summary).toContain('500 GB')
  })

  it('should warn when the disk is nearly full', async () => {
    const answer = await ask(4 * GIGABYTE, 500 * GIGABYTE)

    expect(answer.summary).toContain('nearly full')
  })

  it('should not warn when there is room', async () => {
    const answer = await ask(250 * GIGABYTE, 500 * GIGABYTE)

    expect(answer.summary).not.toContain('nearly full')
  })

  it('should attach a disk card with the raw byte counts', async () => {
    const answer = await ask(250 * GIGABYTE, 500 * GIGABYTE)

    expect(answer.card).toEqual({
      kind: 'disk',
      freeBytes: 250 * GIGABYTE,
      totalBytes: 500 * GIGABYTE
    })
  })

  it('should register as read-only with no executor', () => {
    const registry = new CapabilityRegistry(systemCapabilities(deps(1, 2)))
    const capability = registry.get('disk_space')!

    expect(capability.effect.world).toBe('reads')
    expect(capability.execute).toBeUndefined()
    expect(capability.revert).toBeUndefined()
  })
})

describe('system_toggle', () => {
  it.each([
    ['dark_mode', true, 'Turn dark mode on', 'setDarkMode'],
    ['dark_mode', false, 'Turn dark mode off', 'setDarkMode'],
    ['wifi', false, 'Turn Wi‑Fi off', 'setWifi'],
    ['mute', true, 'Mute the sound', 'setMuted'],
    ['mute', false, 'Unmute the sound', 'setMuted']
  ] as const)(
    'should propose "%s → %s" and call the right dependency',
    async (setting, on, label, dep) => {
      const d = deps(1, 2)
      const cap = new CapabilityRegistry(systemCapabilities(d)).get('system_toggle')!
      const proposal = await cap.plan(cap.params.parse({ setting, on }), ctx)
      if (proposal.kind !== 'plan') throw new Error('expected plan')
      expect(proposal.operations).toHaveLength(1)
      expect(proposal.operations[0].label).toBe(label)
      expect(proposal.operations[0].inverse).toEqual({ setting, on: !on })
      await cap.execute!(proposal.operations[0], ctx)
      expect(d[dep]).toHaveBeenCalledWith(on)
      await cap.revert!(proposal.operations[0], ctx)
      expect(d[dep]).toHaveBeenLastCalledWith(!on)
    }
  )

  it('should be a reversible mutation', () => {
    const cap = new CapabilityRegistry(systemCapabilities(deps(1, 2))).get('system_toggle')!
    expect(cap.effect).toEqual({ world: 'mutates', reversible: true, discloses: 'nothing' })
  })
})

describe('set_volume', () => {
  it('should remember the current level so the change can be undone', async () => {
    const d = deps(1, 2)
    const cap = new CapabilityRegistry(systemCapabilities(d)).get('set_volume')!
    const proposal = await cap.plan(cap.params.parse({ percent: 30 }), ctx)
    if (proposal.kind !== 'plan') throw new Error('expected plan')
    expect(proposal.operations[0]).toMatchObject({
      label: 'Volume 30% (now 65%)',
      payload: { percent: 30 },
      inverse: { percent: 65 }
    })
    await cap.execute!(proposal.operations[0], ctx)
    expect(d.setVolume).toHaveBeenCalledWith(30)
    await cap.revert!(proposal.operations[0], ctx)
    expect(d.setVolume).toHaveBeenLastCalledWith(65)
  })

  it('should reject a level outside 0–100', () => {
    const cap = new CapabilityRegistry(systemCapabilities(deps(1, 2))).get('set_volume')!
    expect(cap.params.safeParse({ percent: 130 }).success).toBe(false)
  })
})
