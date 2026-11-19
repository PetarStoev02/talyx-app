// Files that still break a rule, from before the rule: effects and timers outside the kernel
// (eslint.kernel.mjs), optional properties and magic numbers (eslint.style.mjs). The lists only
// shrink: fix a file (effects and timers move into named hooks under shared/hooks), then delete
// its line. tests/unit/ratchet.test.ts fails when a listed file is clean, and when a list gains a
// file that main's copy of this file does not have. A listed file that is renamed or moved counts
// as a new file: fix it before moving it.

export const RATCHET = {
  effects: [
    'src/renderer/src/App.tsx',
    'src/renderer/src/features/bots/BotAvatar.tsx',
    'src/renderer/src/features/bots/useRosterConnection.ts',
    'src/renderer/src/features/modules/useModuleParts.ts',
    'src/renderer/src/features/setup/InstallOutput.tsx',
    'src/renderer/src/features/setup/ScreenParts.tsx',
    'src/renderer/src/pages/module/ModulePage.tsx',
    'src/renderer/src/pages/usage/UsagePage.tsx',
    'src/renderer/src/shared/ui/ModelPicker.tsx',
    'src/renderer/src/widgets/app-shell/AppShell.tsx',
    'src/renderer/src/widgets/app-shell/ModuleBackground.tsx',
    'src/renderer/src/widgets/app-shell/SidebarFooter.tsx',
    'src/renderer/src/widgets/app-shell/UpdateButton.tsx',
    'src/renderer/src/widgets/settings-about/AboutSection.tsx',
    'src/renderer/src/widgets/settings-engine/AgentAccess.tsx',
    'src/renderer/src/widgets/settings-startup/StartupSection.tsx'
  ],
  timers: [
    'src/renderer/src/app/engine/providers.ts',
    'src/renderer/src/features/bots/BotAvatar.tsx',
    'src/renderer/src/features/bots/approvals.ts',
    'src/renderer/src/features/bots/useRosterConnection.ts',
    'src/renderer/src/features/setup/ScreenParts.tsx',
    'src/renderer/src/widgets/app-shell/UpdateButton.tsx',
    'src/renderer/src/widgets/settings-about/AboutSection.tsx',
    'src/renderer/src/widgets/settings-engine/EngineSection.tsx'
  ],
  optionalProperties: [
    'src/renderer/src/features/bots/types.ts',
    'src/renderer/src/features/chat/botSearch.ts',
    'src/renderer/src/features/chat/chat.ts',
    'src/renderer/src/features/chat/events.ts',
    'src/renderer/src/features/chat/room.ts',
    'src/renderer/src/features/chat/transcript.ts',
    'src/renderer/src/features/chat/types.ts',
    'src/renderer/src/features/shortcuts/shortcuts.ts',
    'src/shared/mcp.ts',
    'src/shared/moduleHost.ts'
  ],
  magicNumbers: [
    'src/main/index.ts',
    'src/main/infrastructure/bridge/DevBridge.ts',
    'src/main/infrastructure/engine/engine.ts',
    'src/main/infrastructure/engine/gateway.ts',
    'src/main/infrastructure/ipc/engine.ipc.ts',
    'src/main/infrastructure/ipc/mcp.ipc.ts',
    'src/main/infrastructure/mcp/mcpServer.ts',
    'src/main/infrastructure/modules/catalog.ts',
    'src/main/infrastructure/modules/moduleHost.ts',
    'src/main/infrastructure/modules/signing.ts',
    'src/main/infrastructure/setup/installRunner.ts',
    'src/main/infrastructure/setup/installSteps.ts',
    'src/main/infrastructure/storage/SettingsStore.ts',
    'src/main/infrastructure/updater/releaseCheck.ts',
    'src/main/infrastructure/updater/selfUpdate.ts',
    'src/renderer/src/features/bots/BotAvatar.tsx',
    'src/renderer/src/features/bots/RoomAvatars.tsx',
    'src/renderer/src/features/bots/look.ts',
    'src/renderer/src/features/bots/roster.ts',
    'src/renderer/src/features/bots/routines.ts',
    'src/renderer/src/features/bots/store.ts',
    'src/renderer/src/features/bots/useRosterConnection.ts',
    'src/renderer/src/features/chat/transcript.ts',
    'src/renderer/src/features/providers/providers.ts',
    'src/renderer/src/features/providers/usage.ts',
    'src/renderer/src/features/setup/ScreenParts.tsx',
    'src/renderer/src/features/updates/items.ts'
  ]
}
