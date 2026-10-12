/**
 * Domain failures for the capability layer fail loudly and specifically —
 * one class per failure mode rather than a generic message.
 */

export class UnresolvableFolderError extends Error {
  readonly key = 'instruction_folder_unknown'
  constructor(readonly reference: string) {
    super(
      `I could not work out which folder "${reference}" means — try a full path, or a name like Downloads or Desktop`
    )
    this.name = 'UnresolvableFolderError'
  }
}

export class FolderNotFoundError extends Error {
  readonly key = 'instruction_folder_missing'
  constructor(readonly folderPath: string) {
    super(`There is no folder at ${folderPath}`)
    this.name = 'FolderNotFoundError'
  }
}

export class RecipientNotFoundError extends Error {
  readonly key = 'instruction_recipient_unknown'
  constructor(readonly query: string) {
    super(`I found nobody called "${query}" in Contacts — try a phone number or an email address`)
    this.name = 'RecipientNotFoundError'
  }
}

/**
 * Sending is irreversible, so several matches is a question for the user, never a
 * guess. The message becomes a tool result the model reads, so it carries names
 * and the last four digits only — nobody's full number leaves the machine to
 * settle a question the user has not even been asked yet.
 */
export class AmbiguousRecipientError extends Error {
  readonly key = 'instruction_recipient_ambiguous'
  constructor(
    readonly query: string,
    readonly candidates: string[]
  ) {
    super(`"${query}" matches more than one contact: ${candidates.join(', ')} — say which one`)
    this.name = 'AmbiguousRecipientError'
  }
}

/**
 * Programmer errors, thrown at construction rather than at execution time, so a
 * broken capability fails at startup and in tests instead of after it has already
 * changed something. Deliberately carry no `key`: they must never be dressed up
 * as a user-facing "I didn't understand you".
 */
export class UnexecutableCapabilityError extends Error {
  constructor(readonly capability: string) {
    super(`Capability "${capability}" changes the world but provides no execute`)
    this.name = 'UnexecutableCapabilityError'
  }
}

/**
 * A capability may be irreversible. It may not be irreversible *quietly* — an
 * undo button that cannot work is worse than no undo button.
 */
export class IrreversibleCapabilityError extends Error {
  constructor(readonly capability: string) {
    super(`Capability "${capability}" claims to be reversible but provides no revert`)
    this.name = 'IrreversibleCapabilityError'
  }
}

export class UnknownKeyError extends Error {
  readonly key = 'instruction_key_unknown'
  constructor(readonly chord: string) {
    super(
      `"${chord}" is not a key combination I can press — use names like cmd+shift+p, return or f5`
    )
    this.name = 'UnknownKeyError'
  }
}

/** Coordinates only mean something relative to a screenshot the model has seen. */
export class ScreenNotSeenError extends Error {
  readonly key = 'instruction_screen_not_seen'
  constructor() {
    super('Look at the screen first (look_at_screen) — positions come from that screenshot')
    this.name = 'ScreenNotSeenError'
  }
}

export class OffScreenPointError extends Error {
  readonly key = 'instruction_point_off_screen'
  constructor(x: number, y: number, width: number, height: number) {
    super(`${x}, ${y} is outside the last screenshot, which is ${width}×${height} pixels`)
    this.name = 'OffScreenPointError'
  }
}

/** Keys sent now would land in Talyx itself rather than the app on screen. */
export class TalyxHasFocusError extends Error {
  readonly key = 'instruction_talyx_has_focus'
  constructor() {
    super('Talyx is still in front, so keys would go to Talyx — click the app to type into first')
    this.name = 'TalyxHasFocusError'
  }
}

export class ScreenCaptureError extends Error {
  readonly key = 'instruction_screen_capture_failed'
  constructor() {
    super('macOS returned no picture of the main display — try again')
    this.name = 'ScreenCaptureError'
  }
}

export class ScreenRecordingPermissionError extends Error {
  readonly key = 'instruction_screen_permission'
  constructor() {
    super(
      'Talyx is not allowed to see the screen. Turn on Talyx in System Settings → Privacy & Security → Screen & System Audio Recording, reopen Talyx, then ask again'
    )
    this.name = 'ScreenRecordingPermissionError'
  }
}

export class AccessibilityPermissionError extends Error {
  readonly key = 'instruction_accessibility_permission'
  constructor() {
    super(
      'Talyx is not allowed to click or type. Turn on Talyx in System Settings → Privacy & Security → Accessibility, then ask again'
    )
    this.name = 'AccessibilityPermissionError'
  }
}
