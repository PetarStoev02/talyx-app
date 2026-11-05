// Onboarding facts both processes need. Must not import 'electron' or node modules: it compiles
// in both the node and web tsconfigs.

export type InstallExit =
  | { kind: 'ok' }
  | { kind: 'failed'; index: number; code: number }
  | { kind: 'cancelled' }

export type InstallSteps =
  | { kind: 'ready'; commands: string[]; engineVersion: string; releaseUrl: string }
  | { kind: 'unavailable'; releaseUrl: string }
  | { kind: 'mismatch'; releaseUrl: string }
  | { kind: 'invalid'; releaseUrl: string }
  | { kind: 'unsupported'; releaseUrl: string }
