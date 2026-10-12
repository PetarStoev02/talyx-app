/** Where a dump lands after Claude (or a chip) picks. */
export type CaptureDestination = 'note' | 'reminder' | 'calendar' | 'file'

/** Capability call the CaptureRunner will dispatch. */
export interface CaptureRoute {
  destination: CaptureDestination
  tool: 'take_note' | 'remind_me' | 'create_event' | 'save_to_inbox'
  input: Record<string, unknown>
}

export interface RouteCaptureInput {
  text: string
  /** When set, destination is fixed; Claude (or heuristics) only fills params. */
  chip: CaptureDestination | null
  /** Null when the owner's Claude is unreachable. */
  claude: {
    complete: (
      messages: Array<{ role: 'user'; text: string }>,
      signal: AbortSignal
    ) => Promise<{ text: string }>
  } | null
  now: Date
  signal: AbortSignal
}
