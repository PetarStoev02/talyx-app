import { execFileSync } from 'child_process'
import { readFileSync } from 'fs'
import { dirname, join, normalize } from 'path'
import { describe, expect, it } from 'vitest'
import { VENDORED_ENGINE_FILES } from '../../eslint.vendored.mjs'

const MAX_GIT_OUTPUT_BYTES = 64 * 1024 * 1024
const GIT_NO_MATCH = 1
const CODE = ['*.ts', '*.tsx', '*.mjs', '*.js', '*.jsx']

// Release notes describe the code as it was at that release; the legal pages name no code.
// Vendored files keep upstream's comments, which name upstream's files.
const SKIPPED = [
  ':(exclude)docs/release-notes/**',
  ':(exclude)website/src/pages/legal/**',
  ...VENDORED_ENGINE_FILES.map((file) => `:(exclude,glob)${file}`)
]

// A backticked path with a folder and a file extension, with an optional `:line` suffix.
const PATH = /`([\w@.-]+(?:\/[\w.-]+)+\.(?:tsx?|mjs|jsx?|json|md|ya?ml|sh|css|html))(?::[\d,-]+)?`/g
// A backticked call with an optional receiver, such as `useRoster.getState()`.
const CALL = /`(?:[A-Za-z_$][\w$]*\.)*([A-Za-z_$][\w$]*)\([^`]*\)`/g
// A name written with `(` after it: a call or a declaration.
const CALLED = /[A-Za-z_$][\w$]*(?=\()/g
// A whole-line comment, or the comment after code (a space before `//` keeps URLs whole).
const COMMENT = /^\s*(?:\/\/|\/\*|\*).*$|\s\/\/.*$/

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

describe('file and function references', () => {
  it('should name only files that exist, in docs, skills and comments', () => {
    const repoFiles = git(['ls-files']).split('\n')
    const exists = (path: string): boolean =>
      repoFiles.some((file) => file === path || file.endsWith(`/${path}`)) || ignored(path)

    const stale = references(['*.md', '*.ts', '*.tsx', '*.mjs', '*.yml'], PATH)
      .map(({ where, file, name }) => ({
        where,
        key: `${file}: ${name}`,
        path: resolvePath(file, name)
      }))
      .filter(({ key, path }) => !ELSEWHERE.has(key) && !exists(path))
      .map(({ where, path }) => `${where}: ${path} (no such file; name the file that holds it now)`)

    expect(stale).toEqual([])
  })

  it('should name only functions the code still has, in markdown', () => {
    // Only code counts, not comments: a same-named variable or a comment that still names a
    // renamed function must not keep its doc line alive.
    const callable = new Set(
      tracked(CODE).flatMap((file) =>
        readFileSync(file, 'utf8')
          .split('\n')
          .flatMap((line) => line.replace(COMMENT, '').match(CALLED) ?? [])
      )
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
  return tracked(globs).flatMap((file) =>
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

function tracked(globs: string[]): string[] {
  return git(['ls-files', '--', ...globs, ...SKIPPED])
    .split('\n')
    .filter(Boolean)
}

// A path starting with ./ or ../ is read from the referring file's folder, an alias path through
// its alias; any other path may name a file from the repo root or from a folder the context implies.
function resolvePath(file: string, path: string): string {
  if (path.startsWith('./') || path.startsWith('../')) return normalize(join(dirname(file), path))
  const alias = Object.keys(ALIASES).find((prefix) => path.startsWith(prefix))
  return alias ? `${ALIASES[alias]}${path.slice(alias.length)}` : path
}

// Gitignored paths (the local specs under docs/superpowers/) are notes kept outside the repo.
function ignored(path: string): boolean {
  try {
    git(['check-ignore', '-q', '--no-index', path])
    return true
  } catch (err) {
    // check-ignore exits 1 for a path it does not ignore; any other failure must fail the test.
    if ((err as { status?: number }).status !== GIT_NO_MATCH) throw err
    return false
  }
}

function git(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: MAX_GIT_OUTPUT_BYTES })
}
