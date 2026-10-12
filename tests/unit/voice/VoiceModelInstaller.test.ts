import { describe, it, expect, vi, beforeEach } from 'vitest'
import { join } from 'path'

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn()
}))

const downloadFile = vi.fn()
vi.mock('@huggingface/hub', () => ({ downloadFile }))

import { existsSync, writeFileSync } from 'fs'
import { VoiceModelInstaller } from '../../../src/main/infrastructure/voice/VoiceModelInstaller'
import { VOICE_MODEL_FILES, whisperModelFiles } from '../../../src/main/domain/ai/voicePresets'

const MODELS_DIR = '/mock/models/voice'
const MODEL_DIR = join(MODELS_DIR, 'onnx-community/whisper-base')

function fakeResponse(): { arrayBuffer: () => Promise<ArrayBuffer> } {
  return { arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) }
}

describe('VoiceModelInstaller', () => {
  let installer: VoiceModelInstaller

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(existsSync).mockReturnValue(false)
    downloadFile.mockResolvedValue(fakeResponse())
    installer = new VoiceModelInstaller(MODELS_DIR)
  })

  it('should download every missing file and report non-decreasing progress ending at 100', async () => {
    vi.mocked(existsSync).mockImplementation((path: unknown) => {
      return String(path).endsWith('tokenizer.json')
    })
    const progress: number[] = []

    await installer.install(whisperModelFiles('fast'), (percent) => progress.push(percent))

    const missingFiles = VOICE_MODEL_FILES.filter((file) => file !== 'tokenizer.json')
    expect(downloadFile).toHaveBeenCalledTimes(missingFiles.length)
    for (const file of missingFiles) {
      expect(downloadFile).toHaveBeenCalledWith({
        repo: 'onnx-community/whisper-base',
        path: file
      })
      expect(writeFileSync).toHaveBeenCalledWith(join(MODEL_DIR, file), expect.anything())
    }
    expect(writeFileSync).not.toHaveBeenCalledWith(
      join(MODEL_DIR, 'tokenizer.json'),
      expect.anything()
    )
    for (let i = 1; i < progress.length; i++) {
      expect(progress[i]).toBeGreaterThanOrEqual(progress[i - 1])
    }
    expect(progress[progress.length - 1]).toBe(100)
  })

  it('should write nothing when a download fails', async () => {
    downloadFile.mockImplementation(({ path }: { path: string }) =>
      path === 'tokenizer.json' ? Promise.resolve(null) : Promise.resolve(fakeResponse())
    )

    await expect(installer.install(whisperModelFiles('fast'), () => {})).rejects.toThrow(
      'Model file missing upstream: onnx-community/whisper-base/tokenizer.json'
    )

    expect(writeFileSync).not.toHaveBeenCalledWith(
      join(MODEL_DIR, 'tokenizer.json'),
      expect.anything()
    )
  })
})
