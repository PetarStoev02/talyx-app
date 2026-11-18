// Usage: npm run module-host
// Writes contract/module-host.d.ts, the module host contract the modules repo type-checks against,
// from src/shared/moduleHost.ts. tests/unit/moduleHostContract.test.ts fails when it is stale.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import prettier from 'prettier'
import ts from 'typescript'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SOURCE = join(ROOT, 'src/shared/moduleHost.ts')
export const MODULE_HOST_DTS = join(ROOT, 'contract/module-host.d.ts')

const HEADER = `// Generated from src/shared/moduleHost.ts by \`npm run module-host\` in talyx-app. Do not edit.
`

/** The declaration file tsc emits for the contract, formatted as the repo formats code. */
export async function moduleHostDeclarations() {
  let emitted = null
  const program = ts.createProgram([SOURCE], {
    declaration: true,
    emitDeclarationOnly: true,
    strict: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    types: []
  })
  const result = program.emit(program.getSourceFile(SOURCE), (_name, text) => (emitted = text))
  const errors = [...ts.getPreEmitDiagnostics(program), ...result.diagnostics]
  if (errors.length > 0 || emitted === null) {
    throw new Error(ts.formatDiagnostics(errors, ts.createCompilerHost({})))
  }
  const options = await prettier.resolveConfig(MODULE_HOST_DTS)
  return prettier.format(HEADER + emitted, { ...options, parser: 'typescript' })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(MODULE_HOST_DTS, await moduleHostDeclarations())
  console.log(`Wrote ${MODULE_HOST_DTS}`)
}
