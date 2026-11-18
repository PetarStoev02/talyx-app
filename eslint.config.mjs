import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'
import { readdirSync } from 'node:fs'
import { builtinModules } from 'node:module'
import path from 'node:path'
import { VENDORED_ENGINE_FILES } from './eslint.vendored.mjs'

const NO_EM_DASH_MESSAGE = 'Em dashes are banned. Rewrite the sentence.'
// Built from parts so this file does not contain the characters it bans.
const BANNED_SPELLINGS = [String.fromCharCode(0x2014), '\\' + 'u2014', '&m' + 'dash;']

const localPlugin = {
  rules: {
    'no-em-dash': {
      meta: { type: 'problem', schema: [] },
      create(context) {
        return {
          Program() {
            const text = context.sourceCode.text
            for (const spelling of BANNED_SPELLINGS) {
              for (
                let at = text.indexOf(spelling);
                at !== -1;
                at = text.indexOf(spelling, at + 1)
              ) {
                const start = context.sourceCode.getLocFromIndex(at)
                const end = context.sourceCode.getLocFromIndex(at + spelling.length)
                context.report({ loc: { start, end }, message: NO_EM_DASH_MESSAGE })
              }
            }
          }
        }
      }
    },
    'no-relative-cross-layer': {
      meta: { type: 'problem', schema: [] },
      create(context) {
        const from = unitOf(context.filename)
        const check = (node) => {
          const source = node.source?.value ?? node.source?.quasis?.[0]?.value.cooked
          if (node.source?.expressions?.length) return
          if (typeof source !== 'string' || !source.startsWith('.')) return
          const to = unitOf(path.resolve(path.dirname(context.filename), source))
          const crosses = to.unit === 'contract' || (from.renderer && to.renderer)
          if (!crosses || to.unit === from.unit) return
          context.report({
            node: node.source,
            message: `This relative import leaves ${from.unit}/: import it as '${to.alias}'.`
          })
        }
        return {
          ImportDeclaration: check,
          ImportExpression: check,
          ExportNamedDeclaration: check,
          ExportAllDeclaration: check,
          TSImportType: check
        }
      }
    }
  }
}

// Layer boundaries (FSD Layer Rules in CLAUDE.md). Each message names the move.
const ROOT = import.meta.dirname
const RENDERER = 'src/renderer/src'
const LAYERS = ['app', 'pages', 'widgets', 'features', 'shared']
// The layers each one may not import. app/ (and App.tsx, main.tsx beside it) may import any.
const UPWARD = {
  pages: {
    layers: ['app'],
    message:
      'pages/ imports only widgets/, features/ and shared/: move the code down or pass it in from App.'
  },
  widgets: {
    layers: ['app', 'pages'],
    message:
      'widgets/ imports only features/ and shared/: move the code down or pass it in as a prop.'
  },
  features: {
    layers: ['app', 'pages', 'widgets'],
    message: 'features/ imports only shared/: move the hook down or inject it.'
  },
  shared: {
    layers: ['app', 'pages', 'widgets', 'features'],
    message: 'shared/ imports nothing above it: move the code down into shared/ or inject it.'
  }
}
// One slice never imports another slice of its own layer; shared/ has segments, not slices.
const SLICED_LAYERS = ['pages', 'widgets', 'features']

/** Where a source file sits: the slice for the renderer's layers, else the process folder. */
function unitOf(file) {
  const parts = path.relative(ROOT, file).split(path.sep)
  const rest = parts.slice(2).join('/')
  if (parts[0] === 'src' && parts[1] === 'shared') {
    return { unit: 'contract', alias: `@contract/${rest}`, renderer: false }
  }
  if (parts.slice(0, 3).join('/') !== RENDERER) {
    return { unit: parts.slice(0, 2).join('/'), alias: null, renderer: false }
  }
  const [layer, slice] = parts.slice(3)
  if (LAYERS.includes(layer) && parts.length > 4) {
    const unit = `${layer}/${slice.replace(/\.[^.]+$/, '')}`
    return { unit, alias: `@${parts.slice(3).join('/')}`, renderer: true }
  }
  return { unit: 'renderer', alias: `@renderer/${parts.slice(3).join('/')}`, renderer: true }
}

/** Matches every alias spelling of a renderer folder: `@app/x`, `@/app/x`, `@renderer/app/x`. */
function aliasOf(folders) {
  return `^@(renderer/|/)?(${folders.join('|')})(/|$)`
}

const RENDERER_RUNTIME = {
  regex: `^(node:.*|${['electron', ...builtinModules].join('|')})(/.*)?$`,
  message:
    'The renderer runs as a web page: reach Electron and Node through window.api (src/shared/api.ts) and an IPC handler in main.'
}

/**
 * Bans the patterns in static imports and re-exports, and in `import('x')` calls (quoted or backticked) and types,
 * which no-restricted-imports does not read. esquery regexes cannot hold a slash, hence `\x2F`.
 */
function restrictImports(patterns) {
  return {
    'no-restricted-imports': ['error', { patterns }],
    'no-restricted-syntax': [
      'error',
      ...patterns.flatMap(({ regex, message }) => {
        const value = `/${regex.replaceAll('/', '\\x2F')}/`
        return [
          {
            selector: `:matches(ImportExpression, TSImportType) > Literal.source[value=${value}]`,
            message
          },
          {
            selector: `ImportExpression > TemplateLiteral.source[expressions.length=0] > TemplateElement[value.cooked=${value}]`,
            message
          }
        ]
      })
    ]
  }
}

function rendererImportBlock(files, patterns) {
  return { files: [files], rules: restrictImports([RENDERER_RUNTIME, ...patterns]) }
}

function sliceBlocks(layer, upward) {
  if (!SLICED_LAYERS.includes(layer)) return []
  const slices = readdirSync(path.join(ROOT, RENDERER, layer), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
  return slices.map((slice) =>
    rendererImportBlock(`${RENDERER}/${layer}/${slice}/**`, [
      upward,
      {
        regex: `^@(renderer/|/)?${layer}/(?!${slice}(/|$))`,
        message: `${layer}/${slice} imports no other ${layer.slice(0, -1)}: move the common code down a layer, or compose the two one layer up.`
      }
    ])
  )
}

// A later block replaces an earlier one's rule options, so each slice block repeats the layer's.
const layerBoundaries = [
  rendererImportBlock(`${RENDERER}/**`, []),
  ...Object.entries(UPWARD).flatMap(([layer, { layers, message }]) => {
    const upward = { regex: aliasOf(layers), message }
    return [rendererImportBlock(`${RENDERER}/${layer}/**`, [upward]), ...sliceBlocks(layer, upward)]
  }),
  {
    files: ['src/main/**', 'src/preload/**', 'src/splash/**', 'src/shared/**'],
    rules: restrictImports([
      {
        regex: `${aliasOf(['renderer', ...LAYERS]).replace('(renderer/|/)?', '')}|^@/|^\\.\\.?/(.*/)?renderer(/|$)`,
        message:
          'main, preload and the contract never import the renderer: move the shared code to src/shared and import it as @contract/.'
      }
    ])
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { local: localPlugin },
    rules: { 'local/no-relative-cross-layer': 'error' }
  }
]

// The website has its own style: it gets the parser and the em dash ban, nothing else.
const appConfigs = [
  tseslint.configs.recommended,
  eslintPluginReact.configs.flat.recommended,
  eslintPluginReact.configs.flat['jsx-runtime'],
  {
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': eslintPluginReactHooks,
      'react-refresh': eslintPluginReactRefresh
    },
    rules: {
      ...eslintPluginReactHooks.configs.recommended.rules,
      ...eslintPluginReactRefresh.configs.vite.rules
    }
  },
  {
    // Vendored files keep upstream's code as written, so a re-sync is a clean diff.
    files: VENDORED_ENGINE_FILES,
    // Upstream's directives target upstream's rules, so some go unused here.
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }
      ]
    }
  },
  {
    // Plain JavaScript has no return type annotations to require.
    files: ['**/*.{js,mjs,cjs}'],
    rules: { '@typescript-eslint/explicit-function-return-type': 'off' }
  },
  eslintConfigPrettier
].flat()

export default defineConfig(
  { ignores: ['**/node_modules', '**/dist', '**/out', 'docs'] },
  appConfigs.map((config) => ({ ...config, ignores: [...(config.ignores ?? []), 'website/**'] })),
  {
    files: ['website/**/*.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser }
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    ignores: VENDORED_ENGINE_FILES,
    plugins: { local: localPlugin },
    rules: { 'local/no-em-dash': 'error' }
  },
  {
    files: ['src/**/*.{js,mjs,cjs,ts,tsx}', 'tests/**/*.{js,mjs,cjs,ts,tsx}'],
    ignores: VENDORED_ENGINE_FILES,
    rules: {
      'no-warning-comments': [
        'error',
        { terms: ['todo', 'fixme', 'hack', 'for now'], location: 'anywhere' }
      ]
    }
  },
  layerBoundaries
)
