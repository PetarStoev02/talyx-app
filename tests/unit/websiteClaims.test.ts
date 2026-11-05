import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const ROOTS = [
  'website/src',
  'website/index.html',
  'website/scripts',
  'website/vercel.json',
  'website/public'
]

function files(path: string): string[] {
  if (statSync(path).isFile()) return [path]
  return readdirSync(path).flatMap((name) => files(join(path, name)))
}

const SITE = ROOTS.flatMap(files).filter((f) => /\.(tsx?|md|html|mjs|json|svg|txt|xml)$/.test(f))

/** Claims that are not true of Talyx 1.0: free, unsigned, macOS and Linux only. */
const RETIRED = [
  /\$\d/,
  /\bpricing\b/i,
  /free trial|\b\d+[- ]day trial|trial (?:ends|expires|info)/i,
  /railway|talyxapp-production/i,
  /\bstripe\b/i,
  /upgrade to pro/i,
  // Windows is said one way while there is no build, plus the roadmap's item, worded as the
  // release notes word it.
  /\bwindows\b(?! comes later\.)(?!',\s+description: 'It comes once the engine runs there\.')/i,
  /built-in AI|local AI|on-device AI/i,
  /refund/i,
  /(?<!not |or )notari[sz]ed/i,
  /windows (?:is )?(?:planned|coming)|coming to windows/i,
  /auto-?updat|updates? (?:are )?delivered automatically/i,
  /\b(?:qwen|smolvlm|gliner|tesseract)\b/i,
  /taxonom/i,
  /vision credits?/i,
  /plausible|@vercel\/analytics|datafast/i,
  /licen[cs]e key/i,
  /100% offline|fully offline|works offline/i,
  // The file organizer's claims. Code like `.sort(` or `sortOrder` is not prose.
  /(?<![.\w])sort(?:s|ed|ing)?\b(?!\()/i,
  /watch[ -]folders?/i,
  /smart local/i,
  /your claude/i,
  /\b0 bytes/i,
  /\bundo\b/i,
  /⌘\s*⇧\s*space/i
]

/**
 * vercel.json lists the retired URLs as redirect sources, so old links keep working;
 * the paths must contain the retired words. Nothing else may.
 */
const REDIRECT_SOURCES: Record<string, string[]> = {
  [/refund/i.source]: ['website/vercel.json'],
  [/taxonom/i.source]: ['website/vercel.json'],
  [/\bpricing\b/i.source]: ['website/vercel.json'],
  [/(?<![.\w])sort(?:s|ed|ing)?\b(?!\()/i.source]: ['website/vercel.json'],
  [/watch[ -]folders?/i.source]: ['website/vercel.json']
}

describe('website claims', () => {
  it.each(RETIRED.map((pattern) => [pattern.source, pattern] as const))(
    'should never claim %s',
    (_label, pattern) => {
      const allowed = REDIRECT_SOURCES[pattern.source] ?? []
      const hits = SITE.filter(
        (file) => !allowed.includes(file) && pattern.test(readFileSync(file, 'utf8'))
      )
      expect(hits).toEqual([])
    }
  )

  it('should state the website analytics in the privacy policy exactly as the site does', () => {
    const data = readFileSync('website/src/shared/data/privacy.ts', 'utf8')
    const sentence = data.match(/SITE_ANALYTICS =\s*'([^']+)'/)?.[1]
    expect(sentence).toBeDefined()
    const policy = readFileSync('website/src/pages/legal/content/privacy.md', 'utf8')
    expect(policy).toContain(sentence)
  })

  it('should send every download to the GitHub release assets', () => {
    const release = readFileSync('website/src/shared/data/release.ts', 'utf8')
    expect(release).toContain('https://github.com/PetarStoev02/talyx-app')
    expect(release).toContain('releases/latest/download')
  })
})
