// Onboarding facts both processes need. Must not import 'electron' or node modules: it compiles
// in both the node and web tsconfigs.

export type InstallExit =
  | { kind: 'ok' }
  | { kind: 'failed'; index: number; code: number }
  | { kind: 'cancelled' }
