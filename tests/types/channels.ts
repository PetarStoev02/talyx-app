// Type-only checks on the channel table, compiled by `npm run typecheck` (never run). Each
// `@ts-expect-error` fails the typecheck when the line under it stops being an error.
import type { PageSettings } from '../../src/shared/settings'
import { buildApi } from '../../src/shared/api'
import { handle } from '../../src/main/infrastructure/ipc/handle'

declare const settings: PageSettings

export function handlerAnswersItsChannelsOutput(): void {
  handle('settings:get', () => settings)
  handle('settings:get', async () => settings)
  // @ts-expect-error A handler that answers another type does not compile.
  handle('settings:get', () => 'light')
  // @ts-expect-error Nor one whose promise resolves to another type.
  handle('app:version', async () => 1)
  // @ts-expect-error A channel outside the table has no handler.
  handle('settings:reset', () => undefined)
}

export async function callerSendsItsChannelsInput(): Promise<void> {
  const api = buildApi({ invoke: async () => null, on: () => () => undefined })
  const saved: PageSettings = await api.setSettings({ theme: 'dark' })
  // @ts-expect-error The page cannot set the engine path through settings:set.
  await api.setSettings({ enginePath: '/bin/sh' })
  // @ts-expect-error A theme outside the schema's enum.
  await api.setNativeTheme('sepia')
  // @ts-expect-error The reply is the channel's output, not any type the caller names.
  const version: number = await api.getAppVersion()
  api.onUpdateState((state) => state.kind)
  void [saved, version]
}
