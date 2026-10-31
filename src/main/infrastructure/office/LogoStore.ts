import { copyFileSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import { InvalidLogoError } from '../../domain/office/errors'

const MAX_LOGO_BYTES = 256 * 1024
const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
}

/** Keeps a copy of each project's logo; the renderer CSP only allows data: images. */
export class LogoStore {
  private readonly dir: string

  constructor(userDataDir: string) {
    this.dir = join(userDataDir, 'logos')
  }

  store(projectId: string, sourcePath: string): string {
    const ext = extname(sourcePath).toLowerCase()
    if (!Object.hasOwn(MIME, ext)) throw new InvalidLogoError('must be a png, jpeg or svg file')
    if (sizeOf(sourcePath) > MAX_LOGO_BYTES) throw new InvalidLogoError('must be 256 KB or less')
    mkdirSync(this.dir, { recursive: true })
    const target = join(this.dir, `${encodeURIComponent(projectId)}${ext}`)
    copyFileSync(sourcePath, target)
    return target
  }

  dataUrl(path: string): string | null {
    const mime = MIME[extname(path).toLowerCase()]
    if (!mime) return null
    try {
      return `data:${mime};base64,${readFileSync(path).toString('base64')}`
    } catch {
      // The stored copy was removed: the tile falls back to the initial.
      return null
    }
  }
}

function sizeOf(path: string): number {
  try {
    return statSync(path).size
  } catch {
    throw new InvalidLogoError('file could not be read')
  }
}
