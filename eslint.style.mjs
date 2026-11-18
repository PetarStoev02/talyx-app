// CLAUDE.md style rules as lint. Each message names the fix. Files from before a rule wait their
// turn in eslint.ratchet.mjs (tests/unit/ratchet.test.ts).
import tseslint from '@electron-toolkit/eslint-config-ts'

export const OPTIONAL_PROPERTY_MESSAGE =
  'No optional properties: write `name: T | null` and set null when there is none.'
export const DEFAULT_EXPORT_MESSAGE =
  'Use a named export (`export function Name` or `export const name`); only config files export a default.'
export const magicNumberMessage = (raw) =>
  `Magic number ${raw}: name it as a constant (\`const WHAT_IT_MEANS = ${raw}\`).`

// Where the rules reach. Data types in the contract and the features; numbers in main and the features.
export const OPTIONAL_PROPERTY_FILES = [
  'src/shared/**/*.ts',
  'src/renderer/src/features/**/*.{ts,tsx}'
]
export const MAGIC_NUMBER_FILES = ['src/main/**/*.ts', 'src/renderer/src/features/**/*.{ts,tsx}']
// An ambient `declare module` mirrors a bundler's default export, so .d.ts files are exempt.
export const DEFAULT_EXPORT_IGNORES = ['**/*.config.{js,mjs,cjs,ts}', '**/*.d.ts']

export const MAGIC_NUMBER_OPTIONS = {
  ignore: [0, 1, -1],
  ignoreArrayIndexes: true,
  ignoreDefaultValues: true,
  ignoreEnums: true,
  ignoreNumericLiteralTypes: true,
  ignoreReadonlyClassProperties: true,
  ignoreTypeIndexes: true
}

const baseMagicNumbers = tseslint.plugin.rules['no-magic-numbers']

/**
 * Props are optional by React's convention: a type named `*Props`, or a type literal written on a
 * parameter (`function X({ a }: { a?: string })`), is exempt.
 */
function isPropsType(property) {
  const literal = property.parent
  if (literal.type === 'TSInterfaceBody') return literal.parent.id.name.endsWith('Props')
  if (literal.type !== 'TSTypeLiteral') return false
  const owner = literal.parent
  if (owner.type === 'TSTypeAliasDeclaration') return owner.id.name.endsWith('Props')
  if (owner.type !== 'TSTypeAnnotation') return false
  const parameter = owner.parent
  return parameter.parent?.params?.includes(parameter) ?? false
}

export const stylePlugin = {
  rules: {
    'no-optional-property': {
      meta: { type: 'suggestion', schema: [] },
      create(context) {
        return {
          'TSPropertySignature[optional=true]'(node) {
            if (!isPropsType(node)) context.report({ node, message: OPTIONAL_PROPERTY_MESSAGE })
          }
        }
      }
    },
    'no-default-export': {
      meta: { type: 'suggestion', schema: [] },
      create(context) {
        const report = (node) => context.report({ node, message: DEFAULT_EXPORT_MESSAGE })
        return {
          ExportDefaultDeclaration: report,
          'ExportSpecifier[exported.name="default"]': report
        }
      }
    },
    // typescript-eslint's rule, with a message that names the fix.
    'no-magic-numbers': {
      meta: baseMagicNumbers.meta,
      defaultOptions: baseMagicNumbers.defaultOptions,
      create(context) {
        // The context is frozen, so the base rule gets one that inherits it with its own report.
        const report = ({ node, data }) =>
          context.report({ node, message: magicNumberMessage(data?.raw ?? node.raw) })
        return baseMagicNumbers.create(Object.create(context, { report: { value: report } }))
      }
    }
  }
}

export const STYLE_RULES = {
  optionalProperties: ['style/no-optional-property', 'error'],
  magicNumbers: ['style/no-magic-numbers', ['error', MAGIC_NUMBER_OPTIONS]]
}
