import { dirname, join } from 'path'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import log from 'electron-log'
import { missingModelFiles, modelDir, type ModelFiles } from '../../domain/ai/voicePresets'

export class VoiceModelInstaller {
  constructor(private readonly modelsDir: string) {}

  isInstalled(model: ModelFiles): boolean {
    return missingModelFiles(this.modelsDir, model, existsSync).length === 0
  }

  /** Downloads only what is missing, so a cancelled install resumes file-by-file. */
  async install(model: ModelFiles, onProgress: (percent: number) => void): Promise<void> {
    const { downloadFile } = await import('@huggingface/hub')
    const targetDir = modelDir(this.modelsDir, model)

    for (const [index, file] of model.files.entries()) {
      const destination = join(targetDir, file)
      onProgress(Math.round((index / model.files.length) * 100))
      if (existsSync(destination)) continue

      const response = await downloadFile({ repo: model.modelId, path: file })
      if (!response) throw new Error(`Model file missing upstream: ${model.modelId}/${file}`)

      mkdirSync(dirname(destination), { recursive: true })
      writeFileSync(destination, Buffer.from(await response.arrayBuffer()))
      log.info(`[VoiceModelInstaller] Downloaded ${model.modelId}/${file}`)
    }

    onProgress(100)
  }
}
