import { describe, it, expect } from 'vitest'
import { SpeechRouter } from '../../../src/main/infrastructure/voice/SpeechRouter'

function fakeOutput(): {
  spoken: [string, string][]
  stops: number
  speak: (t: string, v: string) => void
  stop: () => void
} {
  const out = {
    spoken: [] as [string, string][],
    stops: 0,
    speak(text: string, voice: string) {
      out.spoken.push([text, voice])
    },
    stop() {
      out.stops++
    }
  }
  return out
}

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

function build(
  over: {
    engine?: 'kokoro' | 'system'
    language?: string
    ready?: boolean
    platform?: string
    ensureVoiceFails?: boolean
    ensureVoiceDeferred?: boolean
  } = {}
): {
  router: SpeechRouter
  kokoro: ReturnType<typeof fakeOutput>
  system: ReturnType<typeof fakeOutput>
  ensured: string[]
  resolveEnsureVoice: () => void
} {
  const kokoro = fakeOutput()
  const system = fakeOutput()
  const ensured: string[] = []
  let resolveDeferred: (() => void) | undefined
  const router = new SpeechRouter({
    kokoro,
    system,
    settings: () => ({
      voiceTtsEngine: over.engine ?? 'kokoro',
      voiceTtsVoice: 'bm_lewis',
      appLanguage: over.language ?? 'en'
    }),
    kokoroReady: () => over.ready ?? true,
    ensureVoice: (voice) => {
      ensured.push(voice)
      if (over.ensureVoiceDeferred) {
        return new Promise((resolve) => {
          resolveDeferred = resolve
        })
      }
      return over.ensureVoiceFails ? Promise.reject(new Error('offline')) : Promise.resolve()
    },
    platform: over.platform ?? 'darwin'
  })
  return { router, kokoro, system, ensured, resolveEnsureVoice: () => resolveDeferred?.() }
}

describe('SpeechRouter', () => {
  it('should send English to Kokoro with the configured voice', async () => {
    const { router, kokoro, system, ensured } = build()
    router.speak('Hello there.', 'Samantha')
    await flush()
    expect(ensured).toEqual(['bm_lewis'])
    expect(kokoro.spoken).toEqual([['Hello there.', 'bm_lewis']])
    expect(system.spoken).toEqual([])
  })

  it('should send Bulgarian to the system voice regardless of engine', async () => {
    const { router, kokoro, system } = build({ language: 'bg' })
    router.speak('Готово.', 'Daria')
    await flush()
    expect(kokoro.spoken).toEqual([])
    expect(system.spoken).toEqual([['Готово.', 'Daria']])
  })

  it('should use the system voice when the engine setting says so', async () => {
    const { router, kokoro, system } = build({ engine: 'system' })
    router.speak('Hello.', 'Samantha')
    await flush()
    expect(kokoro.spoken).toEqual([])
    expect(system.spoken).toEqual([['Hello.', 'Samantha']])
  })

  it('should use the system voice until the Kokoro model is installed', async () => {
    const { router, system } = build({ ready: false })
    router.speak('Hello.', 'Samantha')
    await flush()
    expect(system.spoken).toEqual([['Hello.', 'Samantha']])
  })

  it('should use the system voice off macOS', async () => {
    const { router, kokoro, system } = build({ platform: 'win32' })
    router.speak('Hello.', 'Samantha')
    await flush()
    expect(kokoro.spoken).toEqual([])
    expect(system.spoken).toHaveLength(1)
  })

  it('should fall back to the system voice when the voice file cannot be fetched', async () => {
    const { router, kokoro, system } = build({ ensureVoiceFails: true })
    router.speak('Hello.', 'Samantha')
    await flush()
    expect(kokoro.spoken).toEqual([])
    expect(system.spoken).toEqual([['Hello.', 'Samantha']])
  })

  it('should silence Kokoro before handing a reply to the system voice', async () => {
    const { router, kokoro, system } = build({ engine: 'system' })
    router.speak('Hello.', 'Samantha')
    await flush()
    expect(kokoro.stops).toBe(1)
    expect(system.spoken).toEqual([['Hello.', 'Samantha']])
  })

  it('should silence Kokoro when the voice fetch fails mid-reply', async () => {
    const { router, kokoro, system } = build({ ensureVoiceFails: true })
    router.speak('Hello.', 'Samantha')
    await flush()
    expect(kokoro.stops).toBe(1)
    expect(system.spoken).toEqual([['Hello.', 'Samantha']])
  })

  it('should stop both outputs', () => {
    const { router, kokoro, system } = build()
    router.stop()
    expect(kokoro.stops).toBe(1)
    expect(system.stops).toBe(1)
  })

  it('should stay silent when stopped while the voice is still being fetched', async () => {
    const { router, kokoro, system, resolveEnsureVoice } = build({ ensureVoiceDeferred: true })
    router.speak('Hello.', 'Samantha')
    router.stop()
    resolveEnsureVoice()
    await flush()
    expect(kokoro.spoken).toEqual([])
    expect(system.spoken).toEqual([])
  })
})
