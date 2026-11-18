// The renderer kernel (#185): the only places effects and timers are allowed. Everything else in
// the renderer is product code that composes the kernel's named hooks.
// Plain JavaScript on purpose, so the modules repo can copy this file as it is.

export const KERNEL = [
  'src/renderer/src/shared/hooks/**',
  'src/renderer/src/app/providers/**',
  'src/renderer/src/shared/engine/**'
]
export const PRODUCT = ['src/renderer/src/**/*.{js,jsx,ts,tsx}']

const EFFECTS = new Set(['useEffect', 'useLayoutEffect'])
const TIMERS = new Set([
  'setTimeout',
  'setInterval',
  'requestAnimationFrame',
  'requestIdleCallback'
])
const GLOBAL_OBJECTS = new Set(['window', 'globalThis', 'self'])

export const EFFECT_MESSAGE =
  'Effects live in a named hook under shared/hooks. Name what this one does, put it there, and import it.'
export const TIMER_MESSAGE =
  'Timers live in a named hook under shared/hooks (see useNow). Name what this one waits for.'

function propertyName(node) {
  if (!node.computed && node.property.type === 'Identifier') return node.property.name
  if (node.property.type === 'Literal') return node.property.value
  return null
}

const noEffect = {
  meta: { type: 'problem', schema: [] },
  create(context) {
    return {
      // `import { useEffect } from 'react'`, aliased or not.
      ImportSpecifier(node) {
        if (node.parent.source.value !== 'react') return
        if (EFFECTS.has(node.imported.name ?? node.imported.value)) {
          context.report({ node, message: EFFECT_MESSAGE })
        }
      },
      // `React.useEffect(...)` and any other namespace spelling.
      MemberExpression(node) {
        if (EFFECTS.has(propertyName(node))) context.report({ node, message: EFFECT_MESSAGE })
      }
    }
  }
}

const noTimer = {
  meta: { type: 'problem', schema: [] },
  create(context) {
    return {
      // Every unshadowed reference to the global: calls, and passing it on as a value.
      'Program:exit'(program) {
        const scope = context.sourceCode.getScope(program)
        // The TypeScript parser resolves DOM globals to lib variables; others leave them unresolved.
        const libReferences = scope.variables
          .filter((variable) => TIMERS.has(variable.name) && variable.defs.length === 0)
          .flatMap((variable) => variable.references)
        for (const reference of [...scope.through, ...libReferences]) {
          // `ReturnType<typeof setTimeout>` names a type and starts no timer.
          if (reference.identifier.parent.type === 'TSTypeQuery') continue
          if (TIMERS.has(reference.identifier.name)) {
            context.report({ node: reference.identifier, message: TIMER_MESSAGE })
          }
        }
      },
      // `window.setTimeout`, `globalThis.requestAnimationFrame`, `self.setInterval`.
      MemberExpression(node) {
        if (node.object.type !== 'Identifier' || !GLOBAL_OBJECTS.has(node.object.name)) return
        if (TIMERS.has(propertyName(node))) context.report({ node, message: TIMER_MESSAGE })
      }
    }
  }
}

export const kernelPlugin = { rules: { 'no-effect': noEffect, 'no-timer': noTimer } }
