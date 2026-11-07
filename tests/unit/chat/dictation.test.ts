import { describe, expect, it } from 'vitest'
import { dictationProblem } from '../../../src/renderer/src/features/chat/useDictation'
import { t } from '../../../src/renderer/src/shared/lib/i18n'

// The engine's answer when the bot has no speech-to-text provider, as it reaches the renderer.
const NO_PROVIDER =
  'No STT provider available. Install faster-whisper for free local transcription, configure ' +
  'FAKE_LOCAL_STT_COMMAND or install a local whisper CLI, set GROQ_API_KEY for free Groq Whisper'

describe('dictation problems', () => {
  describe('no speech-to-text provider', () => {
    it('should ask for a speech-to-text provider without the engine text', () => {
      expect(dictationProblem(new Error(NO_PROVIDER))).toEqual({
        key: 'chat.dictationNoProvider',
        detail: null
      })
    })

    it('should name no environment variable in its message', () => {
      expect(t('chat.dictationNoProvider')).not.toMatch(/[A-Z]+_[A-Z_]+|STT/)
    })
  })

  describe('microphone denied', () => {
    it('should ask to allow the microphone', () => {
      expect(dictationProblem(new DOMException('Permission denied', 'NotAllowedError'))).toEqual({
        key: 'chat.micDenied',
        detail: null
      })
    })
  })

  describe('other failures', () => {
    it('should keep a short readable engine error as the detail', () => {
      expect(dictationProblem(new Error('Audio file is too large'))).toEqual({
        key: 'chat.dictationFailed',
        detail: 'Audio file is too large'
      })
    })

    it('should drop a long engine error', () => {
      expect(dictationProblem(new Error('x'.repeat(121)))).toEqual({
        key: 'chat.dictationFailed',
        detail: null
      })
    })

    it('should drop an engine error that names an environment variable', () => {
      expect(dictationProblem(new Error('Set OPENAI_API_KEY first'))).toEqual({
        key: 'chat.dictationFailed',
        detail: null
      })
    })

    it('should show the short message alone when nothing explains the failure', () => {
      expect(dictationProblem(null)).toEqual({ key: 'chat.dictationFailed', detail: null })
    })
  })
})
