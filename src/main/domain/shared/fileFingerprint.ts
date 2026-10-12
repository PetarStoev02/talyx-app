import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { createHash } from 'crypto'

const SAMPLE_BYTES = 1024 * 1024 // first 1MB is plenty to identify real-world files

/**
 * Content fingerprint: sha256 of the first 1MB combined with the file size.
 * Rename/move-proof (keyed on bytes, not path) while staying fast for large
 * files. An edited file gets a new fingerprint — which is the correct
 * invalidation: changed content deserves re-classification.
 */
export async function fileFingerprint(filePath: string): Promise<string> {
  const { size } = await stat(filePath)

  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath, { start: 0, end: SAMPLE_BYTES - 1 })
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(`${hash.digest('hex')}-${size}`))
    stream.on('error', reject)
  })
}
