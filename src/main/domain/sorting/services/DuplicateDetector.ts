import { createReadStream } from 'fs'
import { createHash } from 'crypto'

export interface DuplicateGroup {
  hash: string
  size: number
  paths: string[]
}

export class DuplicateDetector {
  /**
   * Compute MD5 hash of a file using streaming to keep memory usage low.
   * MD5 is sufficient for duplicate detection (not security).
   */
  async hashFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('md5')
      const stream = createReadStream(filePath)
      stream.on('data', (chunk) => hash.update(chunk))
      stream.on('end', () => resolve(hash.digest('hex')))
      stream.on('error', reject)
    })
  }

  /**
   * Find exact duplicate files among the given paths.
   * Groups files by size first (fast filter), then by content hash.
   * Returns only groups with 2+ files.
   */
  async detect(
    files: { path: string; size: number }[],
    onProgress?: (current: number, total: number) => void
  ): Promise<DuplicateGroup[]> {
    // Group by size first — files with unique sizes can't be duplicates
    const bySize = new Map<number, { path: string; size: number }[]>()
    for (const file of files) {
      const group = bySize.get(file.size)
      if (group) {
        group.push(file)
      } else {
        bySize.set(file.size, [file])
      }
    }

    const candidates = Array.from(bySize.values()).filter((g) => g.length > 1)
    const toHash = candidates.flat()

    if (toHash.length === 0) return []

    // Hash candidates and group by hash
    const byHash = new Map<string, { paths: string[]; size: number }>()
    let hashed = 0

    for (const file of toHash) {
      try {
        const hash = await this.hashFile(file.path)
        const group = byHash.get(hash)
        if (group) {
          group.paths.push(file.path)
        } else {
          byHash.set(hash, { paths: [file.path], size: file.size })
        }
      } catch {
        // Skip files we can't read (permissions, etc.)
      }
      hashed++
      onProgress?.(hashed, toHash.length)
    }

    // Return only groups with duplicates
    const duplicates: DuplicateGroup[] = []
    for (const [hash, group] of byHash) {
      if (group.paths.length > 1) {
        duplicates.push({ hash, size: group.size, paths: group.paths })
      }
    }

    return duplicates
  }
}
