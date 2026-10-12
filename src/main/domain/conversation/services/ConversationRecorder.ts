import type { OverlayEvent } from '../../agent/Brain'
import { titleFor, type ConversationEntry } from '../model/Conversation'

/** Only what the recorder needs, so the test can stand in for the real repository. */
export interface ConversationStore {
  start(id: string, title: string): void
  append(conversationId: string, entry: ConversationEntry): void
}

/**
 * Writes the transcript as the owner saw it. Every brain event already passes
 * through one place, so this is the only thing that has to observe it: nothing
 * can reach the screen without being saved, and nothing is saved that was never
 * shown.
 */
export class ConversationRecorder {
  private current: string | null = null

  constructor(
    private readonly store: ConversationStore,
    private readonly newId: () => string
  ) {}

  /** Opens or continues a conversation and records the instruction. Returns its id. */
  startedBy(instruction: string): string {
    if (this.current === null) {
      this.current = this.newId()
      this.store.start(this.current, titleFor(instruction))
    }
    this.store.append(this.current, { kind: 'user', payload: { text: instruction } })
    return this.current
  }

  observe(event: OverlayEvent): void {
    if (this.current === null) return
    const entry = entryFor(event)
    if (entry !== null) this.store.append(this.current, entry)
  }

  /** The next instruction starts a fresh conversation. */
  close(): void {
    this.current = null
  }

  /** Continue a conversation the owner opened from the panel. */
  reopen(id: string): void {
    this.current = id
  }

  openId(): string | null {
    return this.current
  }
}

/** null for anything the transcript does not show: status ticks, turn ends, approval cards. */
function entryFor(event: OverlayEvent): ConversationEntry | null {
  switch (event.type) {
    case 'text':
      return { kind: 'assistant', payload: { text: event.text, interim: event.interim } }
    case 'card':
      return { kind: 'card', payload: { card: event.card } }
    case 'action':
      return {
        kind: 'action',
        payload: { label: event.label, ok: event.ok, error: event.error }
      }
    case 'error':
      return { kind: 'error', payload: { key: event.key, message: event.message } }
    default:
      return null
  }
}
