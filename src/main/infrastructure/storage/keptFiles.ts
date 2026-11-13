import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'

const DATA_URL = /^data:[^,]*;base64,([A-Za-z0-9+/=]*)$/
const FALLBACK_NAME = 'file'

/** What the page sent was not a file read as a base64 data URL. */
export class NotADataUrlError extends Error {
  constructor() {
    super('The file could not be read.')
    this.name = 'NotADataUrlError'
  }
}

/**
 * Saves a copy of a file the page has but cannot name a path for (a browser page never learns
 * one; Electron has none for a Mail attachment or a web download), so a bot can open it by path.
 * Each copy gets its own folder: two files with one name never meet, and the name stays as it was.
 * ponytail: copies are never removed; clear old folders when someone notices the space.
 */
export async function keepFile(
  root: string,
  file: { name: string; dataUrl: string }
): Promise<string> {
  const data = DATA_URL.exec(file.dataUrl)?.[1]
  if (data === undefined) throw new NotADataUrlError()
  const folder = join(root, randomUUID())
  await mkdir(folder, { recursive: true })
  const path = join(folder, safeName(file.name))
  await writeFile(path, Buffer.from(data, 'base64'))
  return path
}

// Only the last part of whatever the page called it, so the copy stays inside its own folder.
function safeName(name: string): string {
  const last = basename(name.replaceAll('\\', '/'))
  return last && last !== '.' && last !== '..' ? last : FALLBACK_NAME
}
