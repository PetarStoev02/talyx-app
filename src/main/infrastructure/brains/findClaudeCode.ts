import { execFile } from 'child_process'
import { existsSync } from 'fs'
import { delimiter, join } from 'path'

export interface FindClaudeCodeInput {
  /** `settings.claudeCodePath`; wins when set and present. */
  configured: string | null
  home: string
  pathEnv: string | undefined
  exists: (path: string) => boolean
}

const VERSION_TIMEOUT_MS = 5000

/**
 * Apps launched from Finder get launchd's minimal PATH, so the usual install
 * spots are tried by name before PATH is scanned at all.
 */
function fixedCandidates(home: string): string[] {
  return [
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
    join(home, '.local/bin/claude'),
    join(home, '.claude/local/claude')
  ]
}

/** The first existing candidate, or null when Claude Code is not installed. */
export function findClaudeCode(input: FindClaudeCodeInput): string | null {
  const fromPath = (input.pathEnv ?? '')
    .split(delimiter)
    .filter(Boolean)
    .map((dir) => join(dir, 'claude'))
  const candidates = [
    ...(input.configured ? [input.configured] : []),
    ...fixedCandidates(input.home),
    ...fromPath
  ]
  return candidates.find((candidate) => input.exists(candidate)) ?? null
}

export function findInstalledClaudeCode(configured: string | null, home: string): string | null {
  return findClaudeCode({ configured, home, pathEnv: process.env.PATH, exists: existsSync })
}

/** First line of `claude --version` ("2.1.260 (Claude Code)"); null when it cannot run. */
export function readClaudeCodeVersion(path: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(path, ['--version'], { timeout: VERSION_TIMEOUT_MS }, (err, stdout) => {
      if (err) return resolve(null)
      const line = stdout.split('\n')[0]?.trim() ?? ''
      resolve(line.length > 0 ? line : null)
    })
  })
}
