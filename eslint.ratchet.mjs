// Files that still break a rule, from before the rule: optional properties and stores outside a
// feature's store.ts (eslint.style.mjs). The lists only shrink: fix a file, then delete its line.
// tests/unit/ratchet.test.ts fails when a listed file is clean, and when a list gains a file that
// main's copy of this file does not have. A listed file that is renamed or moved counts as a new
// file: fix it before moving it.

export const RATCHET = {
  optionalProperties: [
    'src/renderer/src/features/bots/types.ts',
    'src/renderer/src/features/chat/botSearch.ts',
    'src/renderer/src/features/chat/room.ts',
    'src/shared/moduleHost.ts'
  ],
  stores: [
    'src/renderer/src/features/bots/approvals.ts',
    'src/renderer/src/features/bots/details.ts',
    'src/renderer/src/features/chat/roomStore.ts',
    'src/renderer/src/features/modules/useNavigation.ts',
    'src/renderer/src/features/settings/sections.ts',
    'src/renderer/src/features/setup/install.ts',
    'src/renderer/src/features/setup/useEngine.ts',
    'src/renderer/src/shared/lib/i18n.ts',
    'src/renderer/src/widgets/shortcuts/useCheatSheet.ts'
  ]
}
