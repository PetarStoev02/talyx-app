import { homedir, platform } from 'os'
import { isAbsolute, join, normalize } from 'path'
import { UnresolvableFolderError } from './errors'

/**
 * The folders people name out loud, mapped to their real location. Spoken
 * references arrive as bare words ("my downloads"), and a bare word resolved
 * against the process directory would silently scan the wrong place — or
 * nothing at all — so anything not recognized here is rejected outright.
 */
const WELL_KNOWN: Record<string, string> = {
  downloads: 'Downloads',
  desktop: 'Desktop',
  documents: 'Documents',
  docs: 'Documents',
  pictures: 'Pictures',
  photos: 'Pictures',
  images: 'Pictures',
  music: 'Music',
  movies: 'Movies',
  videos: platform() === 'darwin' ? 'Movies' : 'Videos'
}

/** Words people wrap a folder name in that carry no meaning of their own. */
const FILLER = /\b(my|the|folder|directory|dir)\b/g

export function resolveFolder(reference: string): string {
  const trimmed = reference.trim()
  if (trimmed.length === 0) throw new UnresolvableFolderError(reference)

  if (trimmed === '~') return homedir()
  if (trimmed.startsWith('~/')) return join(homedir(), trimmed.slice(2))
  if (isAbsolute(trimmed)) return normalize(trimmed)

  const spoken = trimmed.toLowerCase().replace(FILLER, ' ').replace(/\s+/g, ' ').trim()
  const known = WELL_KNOWN[spoken]
  if (known) return join(homedir(), known)

  throw new UnresolvableFolderError(reference)
}

/** The names the model can be told about, so its prompt matches what we accept. */
export function wellKnownFolderNames(): string[] {
  return Object.keys(WELL_KNOWN)
}
