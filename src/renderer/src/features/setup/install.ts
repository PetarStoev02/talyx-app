import { ENGINE_COMMAND } from '@contract/engine'
import type { InstallExit, InstallSteps } from '@contract/setup'

export interface SetupBackend {
  installSteps: () => Promise<InstallSteps>
  run: () => Promise<void>
  cancel: () => Promise<void>
  onOutput: (cb: (index: number, text: string) => void) => () => void
  onExit: (cb: (exit: InstallExit) => void) => () => void
  /** Looks for the engine again; runs after every install that ends ok, whatever screen shows. */
  recheckEngine: () => Promise<void>
}

// eslint-disable-next-line no-control-regex -- matching terminal escapes is the point
const ANSI_CSI = /\x1b\[[0-9;?]*[A-Za-z]/g
// A download the engine's installer gave up on, e.g. a TLS handshake a VPN or proxy broke.
const DOWNLOAD_ERROR = /SSL:|WRONG_VERSION_NUMBER|urlopen error/

/**
 * The output as a terminal would show it: colour codes dropped, and a line redrawn with `\r` (a
 * progress bar) showing only its last state. Copy output keeps the raw text.
 */
export function displayOutput(raw: string): string {
  return raw
    .replace(ANSI_CSI, '')
    .split('\n')
    .map((line) => {
      // A trailing \r (as in \r\n) erases nothing.
      const drawn = line.replace(/\r+$/, '')
      return drawn.slice(drawn.lastIndexOf('\r') + 1)
    })
    .join('\n')
}

/** Whether the install output shows a failed download (network, not the engine). */
export function downloadFailed(output: string): boolean {
  return DOWNLOAD_ERROR.test(output)
}

/** The output with the engine's own name (`name`, from the install steps) shown as Talyx's. */
export function hideEngineName(output: string, name: string | null): string {
  // The name is letters and digits only (see installSteps), so it needs no escaping.
  return name ? output.replace(new RegExp(name, 'gi'), ENGINE_COMMAND) : output
}
