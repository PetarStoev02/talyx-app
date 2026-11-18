import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

// The layer rules live in eslint.config.mjs; these cases prove each block matches real paths.
const eslint = new ESLint()
const R = 'src/renderer/src'

async function errorsFor(filePath: string, source: string): Promise<string[]> {
  const [result] = await eslint.lintText(`${source}\n`, { filePath })
  return result.messages
    .filter((message) => /restricted-(imports|syntax)|cross-layer/.test(message.ruleId ?? ''))
    .map((message) => message.message)
}

describe('layer boundaries', () => {
  it.each([
    [
      'a feature imports app',
      `${R}/features/bots/x.ts`,
      '@app/providers/x',
      'features/ imports only shared/'
    ],
    [
      'a feature imports a page',
      `${R}/features/bots/x.ts`,
      '@pages/agents',
      'features/ imports only shared/'
    ],
    [
      'a feature imports a widget',
      `${R}/features/bots/x.ts`,
      '@widgets/chat',
      'features/ imports only shared/'
    ],
    [
      'a feature imports app by the root alias',
      `${R}/features/bots/x.ts`,
      '@/app/x',
      'features/ imports only shared/'
    ],
    [
      'a feature imports another feature',
      `${R}/features/bots/x.ts`,
      '@features/chat/x',
      'features/bots imports no other feature'
    ],
    [
      'a widget imports app',
      `${R}/widgets/chat/x.tsx`,
      '@app/x',
      'widgets/ imports only features/ and shared/'
    ],
    [
      'a widget imports a page',
      `${R}/widgets/chat/x.tsx`,
      '@renderer/pages/agents',
      'widgets/ imports only features/ and shared/'
    ],
    [
      'a widget imports another widget',
      `${R}/widgets/chat/x.tsx`,
      '@widgets/roster',
      'widgets/chat imports no other widget'
    ],
    [
      'a page imports app',
      `${R}/pages/agents/x.tsx`,
      '@app/x',
      'pages/ imports only widgets/, features/ and shared/'
    ],
    [
      'a page imports another page',
      `${R}/pages/agents/x.tsx`,
      '@pages/settings',
      'pages/agents imports no other page'
    ],
    [
      'shared imports a feature',
      `${R}/shared/lib/x.ts`,
      '@features/bots/x',
      'shared/ imports nothing above it'
    ],
    ['shared imports app', `${R}/shared/ui/x.tsx`, '@app/x', 'shared/ imports nothing above it'],
    ['main imports the renderer', 'src/main/x.ts', '@shared/lib/x', 'never import the renderer'],
    [
      'preload imports the renderer by path',
      'src/preload/x.ts',
      '../renderer/src/shared/x',
      'never import the renderer'
    ],
    [
      'the renderer imports electron',
      `${R}/app/x.ts`,
      'electron',
      'reach Electron and Node through window.api'
    ],
    [
      'the renderer imports a node: module',
      `${R}/features/bots/x.ts`,
      'node:fs',
      'reach Electron and Node through window.api'
    ],
    [
      'the renderer imports a bare Node module',
      `${R}/App.tsx`,
      'path',
      'reach Electron and Node through window.api'
    ],
    [
      'a relative import into another feature',
      `${R}/features/bots/x.ts`,
      '../chat/store',
      "import it as '@features/chat/store'"
    ],
    [
      'a relative import from root into a layer',
      `${R}/main.tsx`,
      './app/browser-bridge',
      "import it as '@app/browser-bridge'"
    ],
    [
      'a relative import into the contract from the renderer',
      `${R}/features/bots/x.ts`,
      '../../../../shared/api',
      "import it as '@contract/api'"
    ],
    [
      'a relative import into the contract from main',
      'src/main/x.ts',
      '../shared/api',
      "import it as '@contract/api'"
    ]
  ])('should reject %s', async (_case, filePath, specifier, message) => {
    const errors = await errorsFor(filePath, `import '${specifier}'`)
    expect(errors).toEqual([expect.stringContaining(message)])
  })

  it.each([
    ['a feature importing shared', `${R}/features/bots/x.ts`, '@shared/lib/utils'],
    ['a feature importing the contract', `${R}/features/bots/x.ts`, '@contract/engine'],
    [
      'a feature importing its own slice by alias',
      `${R}/features/bots/x.ts`,
      '@features/bots/store'
    ],
    ['a relative import inside a slice', `${R}/features/bots/memory/x.ts`, '../store'],
    ['a widget importing a feature', `${R}/widgets/chat/x.tsx`, '@features/chat/x'],
    ['a page importing a widget', `${R}/pages/agents/x.tsx`, '@widgets/chat'],
    ['app importing App', `${R}/app/providers/x.ts`, '@/App'],
    ['app importing a page', `${R}/app/providers/x.ts`, '@pages/agents'],
    ['shared importing another segment', `${R}/shared/ui/x.tsx`, '@/shared/lib/utils'],
    ['main importing a sibling folder', 'src/main/infrastructure/ipc/x.ts', '../engine/engine'],
    ['main importing electron', 'src/main/x.ts', 'electron'],
    [
      'main importing resources',
      'src/main/infrastructure/engine/x.ts',
      '../../../../resources/a?raw'
    ]
  ])('should allow %s', async (_case, filePath, specifier) => {
    expect(await errorsFor(filePath, `import '${specifier}'`)).toEqual([])
  })

  it.each([
    [
      'an import() call',
      `${R}/features/bots/x.ts`,
      "void import('@widgets/chat')",
      'features/ imports only shared/'
    ],
    [
      'an import() type',
      `${R}/features/bots/x.ts`,
      "type T = import('@widgets/chat').T",
      'features/ imports only shared/'
    ],
    [
      'an import() call from preload',
      'src/preload/x.ts',
      "void import('../renderer/src/App')",
      'never import the renderer'
    ],
    [
      'an import() type into the contract',
      `${R}/features/bots/x.ts`,
      "type T = import('../../../../shared/api').Api",
      "import it as '@contract/api'"
    ],
    [
      'a backticked import() call',
      `${R}/features/bots/x.ts`,
      'void import(`@widgets/chat`)',
      'features/ imports only shared/'
    ],
    [
      'a backticked import() of a Node module',
      `${R}/features/bots/x.ts`,
      'void import(`node:fs`)',
      'reach Electron and Node through window.api'
    ],
    [
      'a backticked relative import() into the contract',
      `${R}/features/bots/x.ts`,
      'void import(`../../../../shared/api`)',
      "import it as '@contract/api'"
    ],
    [
      'a backticked import() from preload',
      'src/preload/x.ts',
      'void import(`../renderer/src/App`)',
      'never import the renderer'
    ],
    [
      'a relative import of main from the renderer',
      `${R}/features/bots/x.ts`,
      "import '../../../../main/x'",
      'reach Electron and Node through window.api'
    ],
    [
      'an import of the renderer from splash',
      'src/splash/preload.ts',
      "import '@renderer/App'",
      'never import the renderer'
    ],
    [
      'an alias that walks back into another feature',
      `${R}/features/bots/x.ts`,
      "import '@features/bots/../chat/x'",
      "never walks back with '..'"
    ],
    [
      'an alias that walks back into the renderer from main',
      'src/main/x.ts',
      "import '@contract/../renderer/src/App'",
      "never walks back with '..'"
    ],
    [
      'a backticked alias that walks back',
      `${R}/features/bots/x.ts`,
      'void import(`@features/bots/../chat`)',
      "never walks back with '..'"
    ],
    [
      'a feature importing App',
      `${R}/features/bots/x.ts`,
      "import '@/App.tsx'",
      'features/ imports only shared/'
    ],
    [
      'a widget importing the renderer entry',
      `${R}/widgets/chat/x.tsx`,
      "import '@renderer/main'",
      'widgets/ imports only features/ and shared/'
    ],
    [
      'a file directly under features/ importing a feature',
      `${R}/features/x.ts`,
      "import '@features/chat/x'",
      'A file directly under features/ imports no other feature'
    ],
    [
      'a re-export',
      `${R}/features/bots/x.ts`,
      "export * from '@app/x'",
      'features/ imports only shared/'
    ],
    [
      'a vendored engine file',
      `${R}/shared/engine/client.ts`,
      "import 'electron'",
      'reach Electron and Node through window.api'
    ]
  ])('should reject %s', async (_case, filePath, source, message) => {
    expect(await errorsFor(filePath, source)).toEqual([expect.stringContaining(message)])
  })
})
