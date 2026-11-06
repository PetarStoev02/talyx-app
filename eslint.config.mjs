import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'
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
    }
  }
}

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
  }
)
