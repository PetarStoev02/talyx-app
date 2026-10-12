import type { ZodType } from 'zod/v4'
import type { Effect } from './Effect'

/**
 * Something a capability found. Treated as untrusted by default: it may carry
 * text the user never wrote, so A2's context assembler wraps and caps it before
 * it can reach a prompt.
 */
export interface Evidence {
  text: string
  source: string
}

export interface Operation {
  /** The review row, e.g. "acme-invoice.pdf → Documents / Invoices". */
  label: string
  /** Why this row is in the plan. */
  reason: string
  /** Opaque to the core. Only this capability's executor interprets it. */
  payload: unknown
  /** How to undo this row. Null only when effect.world is 'reads'. */
  inverse: unknown | null
}

/**
 * Capabilities either propose changes that need approving, or answer a question.
 * A union rather than a plan with a `requiresApproval` flag, so the review step
 * cannot be skipped by a mis-set boolean.
 */
/** One clickable path in a result card. */
export interface PathEntry {
  path: string
  label: string
  snippet: string | null
  isDirectory: boolean
}

/**
 * Structured shape of an answer for the UI only; the model still gets the
 * text. Optional because most answers are prose.
 */
export interface CalendarEvent {
  title: string
  /** ISO 8601 with offset. */
  start: string
  end: string
  location: string | null
  calendar: string
  allDay: boolean
  /** Whether the event has notes at all — never the notes themselves, so no meeting content leaves Calendar. */
  hasNotes: boolean
}

export interface MailMessage {
  from: string
  subject: string
  /** ISO 8601. */
  receivedAt: string
  preview: string
}

export type ResultCard =
  | { kind: 'mail'; messages: MailMessage[] }
  | { kind: 'paths'; entries: PathEntry[] }
  | { kind: 'disk'; freeBytes: number; totalBytes: number }
  | { kind: 'agenda'; day: 'today' | 'tomorrow' | 'week'; events: CalendarEvent[] }

/** A picture the model looks at, e.g. a screenshot. Base64 without a data: prefix. */
export interface ScreenImage {
  mediaType: 'image/jpeg' | 'image/png'
  base64: string
}

export type Proposal =
  | {
      kind: 'answer'
      summary: string
      evidence: Evidence[]
      card?: ResultCard
      image?: ScreenImage
    }
  | { kind: 'plan'; summary: string; operations: Operation[] }

/** Ambient context every capability gets. Deliberately tiny — real dependencies
 *  arrive through each capability module's own factory. */
export interface CapabilityContext {
  readonly home: string
  /** Where the user's repositories live; `run_in_repo` may not leave it. */
  readonly projectsRoot: string
  /** Fires on the kill switch; long-running executes must honour it. */
  readonly signal: AbortSignal
  readonly logger: {
    info(message: string): void
    warn(message: string): void
  }
}

/**
 * A bounded operation the user can ask for. The model never constructs one — it
 * names an existing capability and fills parameters, both validated before any
 * planning runs.
 */
export interface Capability<P = unknown> {
  /** Stable identifier the model must reproduce exactly. */
  name: string
  /** One line telling the model when this capability applies. */
  description: string
  /** Real phrasings — few-shot examples, user-facing hints, and eval fixtures. */
  examples: string[]
  /** The validation boundary between model output and the machine. */
  params: ZodType<P>
  effect: Effect
  plan(params: P, ctx: CapabilityContext): Promise<Proposal>
  /** Both required unless effect.world is 'reads'. Enforced at registration.
   *  A returned string is appended to the tool result the model sees. */
  execute?(op: Operation, ctx: CapabilityContext): Promise<string | void>
  revert?(op: Operation, ctx: CapabilityContext): Promise<void>
}
