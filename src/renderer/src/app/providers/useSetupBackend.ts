import type { SetupBackend } from '@features/setup/install'
import { setupApi } from '@shared/api/ipc'
import { useEngine } from './useEngine'

// One instance for the window: `useInstall` subscribes to each backend once.
const backend: SetupBackend = {
  installSteps: setupApi.installSteps,
  run: setupApi.runInstall,
  cancel: setupApi.cancelInstall,
  onOutput: setupApi.onOutput,
  onExit: setupApi.onExit,
  recheckEngine: () => useEngine.getState().check()
}

/** The engine install over IPC, for the setup flow and the engine gate. */
export function useSetupBackend(): SetupBackend {
  return backend
}
