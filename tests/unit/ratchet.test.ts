import { execFileSync } from 'child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { pathToFileURL } from 'url'
import { ESLint, Linter } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, expect, it } from 'vitest'
import { EFFECT_MESSAGE, KERNEL, TIMER_MESSAGE, kernelPlugin } from '../../eslint.kernel.mjs'
import { RATCHET } from '../../eslint.ratchet.mjs'

const R = 'src/renderer/src'
const RATCHET_FILE = 'eslint.ratchet.mjs'
const RULES = { effects: 'kernel/no-effect', timers: 'kernel/no-timer' } as const
type List = keyof typeof RULES
const LISTS = Object.keys(RULES) as List[]

// The whole config, so these cases also prove which paths the rules reach.
const eslint = new ESLint()

async function kernelErrors(filePath: string, source: string): Promise<string[]> {
  const [result] = await eslint.lintText(`${source}\n`, { filePath })
  return result.messages
    .filter((message) => message.ruleId?.startsWith('kernel/'))
    .map((message) => message.message)
}

/** Whether `file` still breaks `list`'s rule, read without the allowlist that exempts it. */
function stillViolates(file: string, list: List): boolean {
  const linter = new Linter({ configType: 'flat' })
  const messages = linter.verify(
    readFileSync(file, 'utf8'),
    [
      {
        files: ['**/*.{js,jsx,ts,tsx}'],
        // A disable comment must not make a listed file look clean.
        linterOptions: { noInlineConfig: true },
        languageOptions: {
          parser: tseslint.parser,
          parserOptions: { ecmaFeatures: { jsx: true } }
        },
        plugins: { kernel: kernelPlugin },
        rules: { [RULES[list]]: 'error' }
      }
    ],
    file
  )
  // Anything but the rule's own report (a parse error, no matching config) must not pass.
  const other = messages.find((message) => message.ruleId !== RULES[list])
  if (other) throw new Error(`${file}: ${other.message}`)
  return messages.length > 0
}

function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

/**
 * The lists as they are where this branch left main; on main itself, as they were one commit
 * before. Null when the base has no ratchet yet (the change that adds it). A missing main ref
 * or base commit fails (a shallow clone): a skipped check would pass any growth.
 */
async function baseRatchet(): Promise<typeof RATCHET | null> {
  const forkPoint = git('merge-base', 'HEAD', 'origin/main')
  const base = forkPoint === git('rev-parse', 'HEAD') ? `${forkPoint}~1` : forkPoint
  try {
    git('rev-parse', '--verify', '--quiet', `${base}^{commit}`)
  } catch {
    throw new Error(
      `No commit ${base} in this clone: check out with full history (fetch-depth: 0).`
    )
  }
  try {
    git('cat-file', '-e', `${base}:${RATCHET_FILE}`)
  } catch {
    return null
  }
  const copy = path.join(mkdtempSync(path.join(tmpdir(), 'ratchet-')), RATCHET_FILE)
  writeFileSync(copy, git('show', `${base}:${RATCHET_FILE}`))
  return ((await import(pathToFileURL(copy).href)) as { RATCHET: typeof RATCHET }).RATCHET
}

describe('kernel rules', () => {
  it.each([
    ['the bare import', `import { useEffect } from 'react'`],
    ['an aliased import', `import { useLayoutEffect as useBefore } from 'react'`],
    ['the namespace form', `import React from 'react'\nReact.useEffect(() => {}, [])`],
    ['a layout effect by namespace', `import * as R from 'react'\nR.useLayoutEffect(() => {})`],
    ['an insertion effect', `import { useInsertionEffect } from 'react'`],
    ['a re-export', `export { useEffect } from 'react'`],
    ['a destructured namespace', `import React from 'react'\nconst { useEffect } = React`],
    ['a re-export of all of React', `export * from 'react'`],
    [
      'a destructuring assignment',
      `import * as R from 'react'\nlet e: unknown\n;({ useLayoutEffect: e } = R)\nvoid e`
    ]
  ])('should refuse an effect outside the kernel: %s', async (_name, source) => {
    expect(await kernelErrors(`${R}/widgets/chat/x.tsx`, source)).toEqual([EFFECT_MESSAGE])
  })

  it.each([
    ['setTimeout', 'setTimeout(() => {}, 1)'],
    ['setInterval', 'setInterval(() => {}, 1)'],
    ['requestAnimationFrame', 'requestAnimationFrame(() => {})'],
    ['requestIdleCallback', 'requestIdleCallback(() => {})'],
    ['the window form', 'window.setTimeout(() => {}, 1)'],
    ['the globalThis form', 'globalThis.requestAnimationFrame(() => {})'],
    ['a timer passed on as a value', 'new Promise((resolve) => setTimeout(resolve, 1))'],
    ['a computed window form', "window['setInterval'](() => {}, 1)"],
    ['a timer reached through window twice', 'window.window.setTimeout(() => {}, 1)'],
    [
      'a timer destructured from window',
      'const { setTimeout: later } = window\nlater(() => {}, 1)'
    ],
    [
      'a timer in a destructuring assignment',
      'let t: unknown\n;({ setInterval: t } = window)\nvoid t'
    ],
    [
      'a timer in a parameter default',
      'export function f({ requestAnimationFrame: frame } = window): void {\n  void frame\n}'
    ],
    ['the Node global form', 'global.setTimeout(() => {}, 1)']
  ])('should refuse a timer outside the kernel: %s', async (_name, source) => {
    expect(await kernelErrors(`${R}/features/bots/x.ts`, source)).toEqual([TIMER_MESSAGE])
  })

  it.each([
    ['a type of the timer', 'let timer: ReturnType<typeof setTimeout> | null = null\nvoid timer'],
    [
      'a local of the same name',
      'const setTimeout = (run: () => void): void => run()\nsetTimeout(() => {})'
    ],
    ['clearing a timer', 'clearTimeout(0)'],
    ['an effect named in a string', "const name = 'useEffect'\nvoid name"],
    [
      'an effect-named field of something else',
      'const hooks = { useEffect: 1 }\nconst { useEffect } = hooks\nvoid [hooks.useEffect, useEffect]'
    ],
    ['other fields of window', 'const { innerWidth } = window\nvoid innerWidth']
  ])('should allow what starts no timer and no effect: %s', async (_name, source) => {
    expect(await kernelErrors(`${R}/widgets/chat/x.tsx`, source)).toEqual([])
  })

  it.each([
    ...KERNEL.map((glob) => glob.replace('/**', '/x.ts')),
    'src/main/x.ts',
    'src/preload/x.ts'
  ])('should allow effects and timers in %s', async (filePath) => {
    const source = `import { useEffect } from 'react'\nuseEffect(() => void setTimeout(() => {}, 1))`
    expect(await kernelErrors(filePath, source)).toEqual([])
  })
})

describe('ratchet', () => {
  it.each(LISTS.flatMap((list) => RATCHET[list].map((file) => [list, file] as const)))(
    'should list only files that still break the rule: %s %s (else remove it from the list)',
    (list, file) => {
      expect(stillViolates(file, list)).toBe(true)
    }
  )

  it.each(LISTS)('should list no file in the kernel, where %s are allowed anyway', (list) => {
    const inKernel = (file: string): boolean =>
      KERNEL.some((glob) => file.startsWith(glob.replace('**', '')))
    expect(RATCHET[list].filter(inKernel)).toEqual([])
  })

  it('should gain no file that the list did not have where this branch left main', async () => {
    const base = await baseRatchet()
    for (const list of LISTS) {
      const added = RATCHET[list].filter((file) => base && !base[list].includes(file))
      expect(added, `${list}: move the new code into a hook under shared/hooks instead`).toEqual([])
    }
  })
})
