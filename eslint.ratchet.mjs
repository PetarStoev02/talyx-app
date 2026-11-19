// Files that still break a rule, from before the rule: stores outside a feature's store.ts
// (eslint.style.mjs). The lists only shrink: fix a file, then delete its line.
// tests/unit/ratchet.test.ts fails when a listed file is clean, and when a list gains a file that
// main's copy of this file does not have. A listed file that is renamed or moved counts as a new
// file: fix it before moving it.

export const RATCHET = {
  stores: []
}
