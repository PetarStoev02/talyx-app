import { execFileSync } from 'child_process'
import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'
import { VENDORED_ENGINE_FILES } from '../../eslint.vendored.mjs'

const MAX_GIT_OUTPUT_BYTES = 64 * 1024 * 1024

// Release notes describe the code as it was at that release; the legal pages name no code.
// Vendored files keep upstream's comments, which name upstream's files.
const SKIPPED = [
  ':(exclude)docs/release-notes/**',
  ':(exclude)website/src/pages/legal/**',
  ...VENDORED_ENGINE_FILES.map((file) => `:(exclude,glob)${file}`)
]

// A backticked path with a folder and a file extension, with an optional `:line` suffix.
const PATH = /`([\w@.-]+(?:\/[\w.-]+)+\.(?:tsx?|mjs|jsx?|json|md|ya?ml|sh|css|html))(?::[\d,-]+)?`/g
// A backticked call such as `layerOpen()` or `useRoster.getState()`.
const CALL = /`(?:[A-Za-z_$][\w$]*\.)*([A-Za-z_$][\w$]*)\([^`]*\)`/g

const ALIASES: Record<string, string> = {
  '@app/': 'src/renderer/src/app/',
  '@pages/': 'src/renderer/src/pages/',
  '@widgets/': 'src/renderer/src/widgets/',
  '@features/': 'src/renderer/src/features/',
  '@shared/': 'src/renderer/src/shared/',
  '@renderer/': 'src/renderer/src/',
  '@contract/': 'src/shared/'
}

// Paths that name files outside this repo on purpose, each with the reason.
const ELSEWHERE = new Set([
  // Re-syncing the vendored client: files in the engine desktop app's repo, not this one.
  'README.md: src/store/transcript-tail.ts',
  'README.md: electron/local-gateway.ts'
])

describe('references in docs and comments', () => {
  it('should name only files that exist', () => {
    const tracked = git(['ls-files']).split('\n')
    const exists = (path: string): boolean =>
      tracked.some((file) => file === path || file.endsWith(`/${path}`)) || ignored(path)

    const stale = references(['*.md', '*.ts', '*.tsx', '*.mjs', '*.yml'], PATH)
      .map(({ where, file, name }) => ({
        where,
        key: `${file}: ${name}`,
        path: resolveAlias(name)
      }))
      .filter(({ key, path }) => !ELSEWHERE.has(key) && !exists(path))
      .map(({ where, path }) => `${where}: ${path} (no such file; name the file that holds it now)`)

    expect(stale).toEqual([])
  })

  it('should name only functions the code still has in markdown', () => {
    // Names written as a call or a declaration somewhere in the code, so a same-named variable
    // does not keep a renamed function's doc line alive.
    const callable = new Set(
      git([
        'grep',
        '-hoE',
        '[A-Za-z_$][A-Za-z0-9_$]*[(]',
        '--',
        '*.ts',
        '*.tsx',
        '*.mjs',
        '*.js',
        '*.jsx'
      ])
        .split('\n')
        .map((call) => call.slice(0, -1))
    )

    const stale = references(['*.md'], CALL)
      .filter(({ name }) => !callable.has(name))
      .map(
        ({ where, name }) => `${where}: ${name}() (no such function; name the one the code calls)`
      )

    expect(stale).toEqual([])
  })
})

interface Reference {
  where: string
  file: string
  name: string
}

function references(globs: string[], pattern: RegExp): Reference[] {
  return git(['ls-files', '--', ...globs, ...SKIPPED])
    .split('\n')
    .filter(Boolean)
    .flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, index) =>
          [...line.matchAll(pattern)].map(([, name]) => ({
            where: `${file}:${index + 1}`,
            file,
            name: name ?? ''
          }))
        )
    )
}

function resolveAlias(path: string): string {
  const alias = Object.keys(ALIASES).find((prefix) => path.startsWith(prefix))
  return alias ? `${ALIASES[alias]}${path.slice(alias.length)}` : path
}

// Gitignored paths (the local specs under docs/superpowers/) are notes kept outside the repo.
function ignored(path: string): boolean {
  try {
    git(['check-ignore', '-q', '--no-index', path])
    return true
  } catch {
    return false
  }
}

function git(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: MAX_GIT_OUTPUT_BYTES })
}
