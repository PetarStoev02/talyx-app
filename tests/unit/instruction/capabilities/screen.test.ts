import { describe, it, expect, vi } from 'vitest'
import { CapabilityRegistry } from '../../../../src/main/domain/instruction/model/CapabilityRegistry'
import {
  screenCapabilities,
  SEEN_FOR_MS,
  type ScreenDeps
} from '../../../../src/main/domain/instruction/capabilities/screen'
import type {
  Capability,
  CapabilityContext,
  Proposal
} from '../../../../src/main/domain/instruction/model/Capability'
import {
  OffScreenPointError,
  ScreenNotSeenError
} from '../../../../src/main/domain/instruction/model/errors'

function context(signal = new AbortController().signal): CapabilityContext {
  return { home: '/h', projectsRoot: '/h/Code', signal, logger: { info: () => {}, warn: () => {} } }
}

/** A 2560×1600-point display captured at 1280×800: half a pixel per point. */
function deps(overrides: Partial<ScreenDeps> = {}): ScreenDeps {
  return {
    capture: vi.fn(async () => ({
      image: { mediaType: 'image/jpeg' as const, base64: 'AAAA' },
      origin: { x: 0, y: 0 },
      width: 1280,
      height: 800,
      scale: 0.5
    })),
    click: vi.fn(async () => {}),
    type: vi.fn(async () => {}),
    press: vi.fn(async () => {}),
    scroll: vi.fn(async () => {}),
    now: () => new Date('2026-09-28T10:00:00.000Z'),
    ...overrides
  }
}

function abilities(d: ScreenDeps): (name: string) => Capability {
  const registry = new CapabilityRegistry(screenCapabilities(d))
  return (name) => registry.get(name)!
}

async function plan(cap: Capability, input: unknown, ctx = context()): Promise<Proposal> {
  return cap.plan(cap.params.parse(input), ctx)
}

async function planned(
  cap: Capability,
  input: unknown
): Promise<Extract<Proposal, { kind: 'plan' }>> {
  const proposal = await plan(cap, input)
  if (proposal.kind !== 'plan') throw new Error('expected a plan')
  return proposal
}

describe('screen capabilities', () => {
  it('should look without asking and hand the screenshot to the model', async () => {
    const get = abilities(deps())
    const look = get('look_at_screen')
    expect(look.effect).toEqual({ reversible: false, world: 'reads', discloses: 'content' })
    const proposal = await plan(look, {})
    if (proposal.kind !== 'answer') throw new Error('expected an answer')
    expect(proposal.image).toEqual({ mediaType: 'image/jpeg', base64: 'AAAA' })
    expect(proposal.summary).toContain('1280×800')
  })

  it.each(['click', 'type_text', 'press_keys', 'scroll'])(
    'should show the card before %s because nothing takes it back',
    (name) => {
      expect(abilities(deps())(name).effect).toEqual({
        reversible: false,
        world: 'mutates',
        discloses: 'nothing'
      })
    }
  )

  describe('click', () => {
    it('should refuse to click before looking at the screen', async () => {
      const click = abilities(deps())('click')
      await expect(plan(click, { x: 10, y: 10, target: 'Send' })).rejects.toThrow(
        ScreenNotSeenError
      )
    })

    it('should ask for a fresh look when the last one is too old to trust', async () => {
      let now = new Date('2026-09-28T10:00:00.000Z')
      const get = abilities(deps({ now: () => now }))
      await plan(get('look_at_screen'), {})
      now = new Date(now.getTime() + SEEN_FOR_MS + 1)
      await expect(plan(get('click'), { x: 10, y: 10, target: 'Send' })).rejects.toThrow(
        ScreenNotSeenError
      )
    })

    it('should refuse a point outside the last screenshot', async () => {
      const get = abilities(deps())
      await plan(get('look_at_screen'), {})
      await expect(plan(get('click'), { x: 1280, y: 10, target: 'Send' })).rejects.toThrow(
        OffScreenPointError
      )
    })

    it('should name the target on the card and click in display points', async () => {
      const d = deps()
      const get = abilities(d)
      await plan(get('look_at_screen'), {})
      const click = get('click')
      const proposal = await planned(click, { x: 512, y: 300, target: 'the Send button' })
      expect(proposal.operations[0].label).toBe('Click “the Send button”')
      await click.execute!(proposal.operations[0], context())
      expect(d.click).toHaveBeenCalledWith({ x: 1024, y: 600 }, 'left', 1)
    })

    it('should offset clicks by where that display sits, so a second monitor works', async () => {
      const d = deps({
        capture: vi.fn(async () => ({
          image: { mediaType: 'image/jpeg' as const, base64: 'AAAA' },
          origin: { x: 1512, y: -300 },
          width: 1280,
          height: 800,
          scale: 0.5
        }))
      })
      const get = abilities(d)
      await plan(get('look_at_screen'), {})
      const proposal = await planned(get('click'), { x: 100, y: 50, target: 'Send' })
      await get('click').execute!(proposal.operations[0], context())
      expect(d.click).toHaveBeenCalledWith({ x: 1712, y: -200 }, 'left', 1)
    })

    it.each([
      [{ button: 'right' }, 'Right-click “Send”', 'right', 1],
      [{ clicks: 2 }, 'Double-click “Send”', 'left', 2],
      [{ clicks: 3 }, 'Triple-click “Send”', 'left', 3]
    ])('should label %j', async (extra, label, button, count) => {
      const d = deps()
      const get = abilities(d)
      await plan(get('look_at_screen'), {})
      const proposal = await planned(get('click'), { x: 1, y: 1, target: 'Send', ...extra })
      expect(proposal.operations[0].label).toBe(label)
      await get('click').execute!(proposal.operations[0], context())
      expect(d.click).toHaveBeenCalledWith({ x: 2, y: 2 }, button, count)
    })
  })

  describe('type_text', () => {
    it('should quote short text and shorten long text on the card', async () => {
      const typeText = abilities(deps())('type_text')
      expect((await planned(typeText, { text: 'hello' })).operations[0].label).toBe('Type "hello"')
      const long = 'x'.repeat(100)
      expect((await planned(typeText, { text: long })).operations[0].label).toBe(
        `Type "${'x'.repeat(60)}…"`
      )
    })

    it('should hand the kill switch to the driver so typing stops mid-way', async () => {
      const controller = new AbortController()
      const d = deps()
      const typeText = abilities(d)('type_text')
      const proposal = await planned(typeText, { text: 'hello' })
      await typeText.execute!(proposal.operations[0], context(controller.signal))
      expect(d.type).toHaveBeenCalledWith('hello', controller.signal)
    })
  })

  describe('press_keys', () => {
    it('should show the chord in symbols and press it', async () => {
      const d = deps()
      const press = abilities(d)('press_keys')
      const proposal = await planned(press, { keys: 'cmd+shift+p' })
      expect(proposal.operations[0].label).toBe('Press ⇧⌘P')
      await press.execute!(proposal.operations[0], context())
      expect(d.press).toHaveBeenCalledWith(expect.objectContaining({ keyCode: 35 }))
    })

    it('should reject a key it does not know as invalid parameters', () => {
      const press = abilities(deps())('press_keys')
      expect(press.params.safeParse({ keys: 'cmd+banana' }).success).toBe(false)
    })
  })

  describe('scroll', () => {
    it('should scroll at the target in display points', async () => {
      const d = deps()
      const get = abilities(d)
      await plan(get('look_at_screen'), {})
      const proposal = await planned(get('scroll'), {
        x: 100,
        y: 200,
        target: 'the message list',
        direction: 'down'
      })
      expect(proposal.operations[0].label).toBe('Scroll down in “the message list”')
      await get('scroll').execute!(proposal.operations[0], context())
      expect(d.scroll).toHaveBeenCalledWith({ x: 200, y: 400 }, 'down', 5)
    })
  })
})
