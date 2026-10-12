import { describe, it, expect, beforeEach } from 'vitest'
import { VoiceNarrator } from '../../../src/main/infrastructure/voice/VoiceNarrator'

class FakeSpeaker {
  spoken: { text: string; voice: string }[] = []
  stops = 0
  speak(text: string, voice: string): void {
    this.spoken.push({ text, voice })
  }
  stop(): void {
    this.stops++
  }
}

let speaker: FakeSpeaker

function narrator(
  settings: { voiceSpeakReplies?: boolean; appLanguage?: string } = {}
): VoiceNarrator {
  speaker = new FakeSpeaker()
  return new VoiceNarrator(speaker, () => ({
    voiceSpeakReplies: settings.voiceSpeakReplies ?? true,
    voiceMode: settings.voiceMode ?? false,
    appLanguage: settings.appLanguage ?? 'en'
  }))
}

describe('VoiceNarrator', () => {
  beforeEach(() => {
    speaker = new FakeSpeaker()
  })

  it('should speak a final reply in the English voice', () => {
    narrator().observe({ type: 'text', text: 'Four repos.', interim: false })
    expect(speaker.spoken).toEqual([{ text: 'Four repos.', voice: 'Samantha' }])
  })

  it('should speak Bulgarian in the Bulgarian voice', () => {
    narrator({ appLanguage: 'bg' }).observe({ type: 'text', text: 'Готово.', interim: false })
    expect(speaker.spoken[0].voice).toBe('Daria')
  })

  it('should stay silent on interim narration', () => {
    narrator().observe({ type: 'text', text: 'Looking…', interim: true })
    expect(speaker.spoken).toEqual([])
  })

  it('should stop speaking when an approval card goes up', () => {
    const subject = narrator()
    subject.observe({ type: 'text', text: 'About to move 4 files.', interim: false })
    subject.observe({ type: 'approval', request: { text: '', proposals: [] } })
    expect(speaker.stops).toBe(1)
  })

  it('should not stop speech on done after a final reply', () => {
    const subject = narrator()
    subject.observe({ type: 'text', text: 'Four repos.', interim: false })
    subject.observe({ type: 'done' })
    expect(speaker.stops).toBe(0)
  })

  it('should stop speaking on an error', () => {
    narrator().observe({ type: 'error', key: 'agent_failed', message: 'x' })
    expect(speaker.stops).toBe(1)
  })

  it('should stop speaking via the explicit stop method', () => {
    const subject = narrator()
    subject.stop()
    expect(speaker.stops).toBe(1)
  })

  it('should say nothing at all when the setting is off', () => {
    narrator({ voiceSpeakReplies: false }).observe({
      type: 'text',
      text: 'Four repos.',
      interim: false
    })
    expect(speaker.spoken).toEqual([])
  })

  it('should still stop speech on error when the setting is off mid-utterance', () => {
    narrator({ voiceSpeakReplies: false }).observe({
      type: 'error',
      key: 'agent_failed',
      message: 'x'
    })
    expect(speaker.stops).toBe(1)
  })

  it('should speak in voice mode even when the speak toggle is off', () => {
    narrator({ voiceSpeakReplies: false, voiceMode: true }).observe({
      type: 'text',
      text: 'Four repos.',
      interim: false
    })
    expect(speaker.spoken).toEqual([{ text: 'Four repos.', voice: 'Samantha' }])
  })

  it('should flatten markdown before speaking', () => {
    narrator().observe({ type: 'text', text: '**Four** repos in `~/Code`.', interim: false })
    expect(speaker.spoken[0].text).toBe('Four repos in ~/Code.')
  })

  it('should ignore statuses, cards and actions', () => {
    const subject = narrator()
    subject.observe({ type: 'status', state: 'thinking', label: '' })
    subject.observe({ type: 'action', label: 'Moved 4 files', ok: true, error: null })
    expect(speaker.spoken).toEqual([])
    expect(speaker.stops).toBe(0)
  })
})
