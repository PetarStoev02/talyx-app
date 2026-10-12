import { mkdirSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const INBOX_DIR = 'Documents/Talyx Capture'

/** Safe filename stem from a capture title. */
export function safeCaptureStem(title: string): string {
  const cleaned = title
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return (cleaned.length > 0 ? cleaned : 'capture').slice(0, 60)
}

function dateStamp(now: Date): string {
  const pad = (n: number): string => n.toString().padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/**
 * Pick a free path under ~/Documents/Talyx Capture for a new dump.
 * Collisions get -2, -3, …
 */
export function captureInboxPath(
  title: string,
  now: Date,
  home = homedir(),
  exists: (path: string) => boolean = existsSync
): string {
  const dir = join(home, INBOX_DIR)
  const stem = safeCaptureStem(title)
  const stamp = dateStamp(now)
  let path = join(dir, `${stem}-${stamp}.md`)
  let n = 2
  while (exists(path)) {
    path = join(dir, `${stem}-${stamp}-${n}.md`)
    n += 1
  }
  return path
}

export function writeCaptureInboxFile(input: {
  title: string
  body: string
  now?: Date
  home?: string
}): { path: string } {
  const now = input.now ?? new Date()
  const path = captureInboxPath(input.title, now, input.home)
  mkdirSync(join(input.home ?? homedir(), INBOX_DIR), { recursive: true })
  const body = input.body.trim().length > 0 ? input.body : input.title
  const markdown = `# ${input.title}\n\n${body}\n`
  writeFileSync(path, markdown, 'utf8')
  return { path }
}
