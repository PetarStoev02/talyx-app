// Vendored from the engine's desktop app (see README, Engine). Upstream's own lint rules and
// prose style differ; keeping its code as written is what makes a re-sync a clean diff.
// Plain `*` globs only: the em dash test feeds these to git pathspec `:(glob)`, which has no braces.
const ENGINE_DIR = 'src/renderer/src/shared/engine'

const VENDORED_CLIENT_FILES = [
  'canonical-protocol',
  'client',
  'config',
  'cron',
  'gateway-contract.generated',
  'gateway-events',
  'gateway-rpc',
  'json-rpc-channel',
  'json-rpc-gateway',
  'models',
  'profiles',
  'reconnect-backoff',
  'session-http-mutations',
  'session-owner-stamp',
  'sessions',
  'transcript-tail',
  'types'
].map((name) => `${ENGINE_DIR}/${name}.ts`)

export const VENDORED_ENGINE_FILES = [
  ...VENDORED_CLIENT_FILES,
  'tests/unit/engine/canonical-*.test.ts'
]
