import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'
import { EFFECT_MESSAGE, KERNEL, TIMER_MESSAGE } from '../../eslint.kernel.mjs'
import {
  DEFAULT_EXPORT_MESSAGE,
  OPTIONAL_PROPERTY_MESSAGE,
  STORE_MESSAGE,
  magicNumberMessage
} from '../../eslint.style.mjs'

const R = 'src/renderer/src'

// The whole config, so these cases also prove which paths the rules reach.
const eslint = new ESLint()

async function errorsOf(plugin: string, filePath: string, source: string): Promise<string[]> {
  const [result] = await eslint.lintText(`${source}\n`, { filePath })
  return result.messages
    .filter((message) => message.ruleId?.startsWith(`${plugin}/`))
    .map((message) => message.message)
}

const kernelErrors = (filePath: string, source: string): Promise<string[]> =>
  errorsOf('kernel', filePath, source)
const styleErrors = (filePath: string, source: string): Promise<string[]> =>
  errorsOf('style', filePath, source)

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
    ['other fields of window', 'const { innerWidth } = window\nvoid innerWidth'],
    ['a TypeScript require import', "import x = require('./y')\nconst { a } = x\nvoid a"]
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

describe('style rules', () => {
  it.each([`${R}/features/bots/x.ts`, 'src/shared/x.ts'])(
    'should refuse an optional property in a data type in %s',
    async (filePath) => {
      expect(await styleErrors(filePath, 'export interface Bot {\n  title?: string\n}')).toEqual([
        OPTIONAL_PROPERTY_MESSAGE
      ])
    }
  )

  it.each([
    ['a props interface', 'export interface AvatarProps {\n  size?: number\n}'],
    ['a props type alias', 'export type AvatarProps = { size?: number }'],
    [
      'an inline props type on a component',
      'export function Avatar({ size }: { size?: number }): number {\n  return size ?? 0\n}'
    ],
    [
      'an inline props type on an arrow component',
      'export const Avatar = ({ size }: { size?: number }): number => size ?? 0'
    ],
    ['a zod-inferred type', 'import { z } from "zod"\nexport type X = z.infer<typeof X>'],
    ['a nullable property', 'export interface Bot {\n  title: string | null\n}']
  ])('should allow %s', async (_name, source) => {
    expect(await styleErrors(`${R}/features/bots/x.tsx`, source)).toEqual([])
  })

  it('should refuse an optional property in an inline parameter type of a plain function', async () => {
    const source = 'export function save(change: { title?: string }): void {\n  void change\n}'
    expect(await styleErrors(`${R}/features/bots/x.ts`, source)).toEqual([
      OPTIONAL_PROPERTY_MESSAGE
    ])
  })

  it.each([`${R}/widgets/chat/x.ts`, 'src/shared/moduleHost.ts'])(
    'should leave optional properties alone outside the contract and the features: %s',
    async (filePath) => {
      const source = 'export interface Bot {\n  title?: string\n}'
      expect(await styleErrors(filePath, source)).toEqual([])
    }
  )

  it.each([
    ['a default declaration', 'export default function f(): void {}'],
    ['a default specifier', 'const f = 1\nexport { f as default }']
  ])('should refuse %s', async (_name, source) => {
    expect(await styleErrors(`${R}/widgets/chat/x.ts`, source)).toEqual([DEFAULT_EXPORT_MESSAGE])
  })

  it.each(['electron.vite.config.ts', 'tests/fixtures/x/vite.config.ts', 'src/main/x.d.ts'])(
    'should allow a default export in %s',
    async (filePath) => {
      expect(await styleErrors(filePath, 'const f = 1\nexport default f')).toEqual([])
    }
  )

  it.each(['src/main/x.ts', `${R}/features/chat/x.ts`])(
    'should refuse a magic number in %s',
    async (filePath) => {
      expect(await styleErrors(filePath, 'export const f = (n: number): number => n * 60')).toEqual(
        [magicNumberMessage('60')]
      )
    }
  )

  it.each([
    ['0, 1 and -1', 'export const f = (n: number): number => (n - 1) * -1 + 0'],
    ['an array index', 'export const f = (a: number[]): number | undefined => a[2]'],
    ['a named constant', 'const MINUTE = 60\nexport const f = (n: number): number => n * MINUTE'],
    ['a default value', 'export const f = (n = 5): number => n'],
    ['a numeric literal type', 'export type Version = 2']
  ])('should allow %s', async (_name, source) => {
    expect(await styleErrors('src/main/x.ts', source)).toEqual([])
  })

  it.each([`${R}/features/bots/x.ts`, `${R}/widgets/roster/x.ts`, `${R}/shared/lib/x.ts`])(
    'should refuse a store outside a feature store.ts: %s',
    async (filePath) => {
      expect(await styleErrors(filePath, "import { create } from 'zustand'")).toEqual([
        STORE_MESSAGE
      ])
    }
  )

  it.each([
    ['the vanilla entry point', "import { createStore } from 'zustand/vanilla'"],
    ['a re-export', "export { create } from 'zustand'"],
    ['a re-export of all of zustand', "export * from 'zustand'"]
  ])('should refuse a store made another way: %s', async (_name, source) => {
    expect(await styleErrors(`${R}/widgets/roster/x.ts`, source)).toEqual([STORE_MESSAGE])
  })

  it.each([`${R}/features/bots/store.ts`, `${R}/app/providers/x.ts`])(
    'should allow a store in %s',
    async (filePath) => {
      expect(await styleErrors(filePath, "import { create } from 'zustand'")).toEqual([])
    }
  )

  it.each([
    ['a type import', "import type { StoreApi } from 'zustand'\nexport type S = StoreApi<number>"],
    [
      'an inline type specifier',
      "import { type StoreApi } from 'zustand'\nexport type S = StoreApi<number>"
    ]
  ])('should allow %s from zustand anywhere', async (_name, source) => {
    expect(await styleErrors(`${R}/widgets/roster/x.ts`, source)).toEqual([])
  })

  it('should leave numbers alone outside main and the features', async () => {
    const source = 'export const f = (n: number): number => n * 60'
    expect(await styleErrors(`${R}/widgets/chat/x.ts`, source)).toEqual([])
  })
})
