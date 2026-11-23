import { ENGINE_COMMAND } from '@contract/engine'

/**
 * Engine text (install output, a failed reply) with the engine's own name shown as Talyx's
 * command. `name` is the engine's: from the install steps, or the attached engine's handle.
 */
export function hideEngineName(text: string, name: string | null): string {
  // The name is letters and digits only (see installSteps and engineWire), so it needs no escaping.
  return name ? text.replace(new RegExp(name, 'gi'), ENGINE_COMMAND) : text
}
