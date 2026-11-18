// Type-checks one tsconfig. The vendored engine files (eslint.vendored.mjs) are checked without
// the flags upstream's code does not meet, so they stay as written and a re-sync stays a clean
// diff; every other file gets the tsconfig's full options.
import path from 'path'
import ts from 'typescript'
import { VENDORED_ENGINE_FILES } from '../eslint.vendored.mjs'

const UPSTREAM_OFF = { noUncheckedIndexedAccess: false, exactOptionalPropertyTypes: false }

const configPath = process.argv[2]
if (!configPath) throw new Error('Usage: node scripts/typecheck.mjs <tsconfig>')

const config = ts.getParsedCommandLineOfConfigFile(
  configPath,
  {},
  {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) => report([diagnostic])
  }
)
// What tsc -p would refuse (an unknown option, an include that matches nothing) fails here too.
report(config.errors)
const options = { ...config.options, composite: false, noEmit: true }
const strict = ts.createProgram({ rootNames: config.fileNames, options })
const loose = ts.createProgram({
  rootNames: config.fileNames,
  options: { ...options, ...UPSTREAM_OFF },
  oldProgram: strict
})

const diagnostics = [
  ...ts.getPreEmitDiagnostics(strict).filter((d) => !d.file || !isVendored(d.file.fileName)),
  ...loose
    .getSourceFiles()
    .filter((file) => isVendored(file.fileName))
    .flatMap((file) => [
      ...loose.getSyntacticDiagnostics(file),
      ...loose.getSemanticDiagnostics(file)
    ])
]
report(diagnostics)

function isVendored(fileName) {
  const relative = path.relative(process.cwd(), fileName)
  return VENDORED_ENGINE_FILES.some((pattern) => path.matchesGlob(relative, pattern))
}

function report(found) {
  if (found.length === 0) return
  const host = {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    getNewLine: () => ts.sys.newLine
  }
  process.stdout.write(ts.formatDiagnosticsWithColorAndContext(found, host))
  process.exit(1)
}
