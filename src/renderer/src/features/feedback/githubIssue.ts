export const TALYX_NEW_ISSUE_URL = 'https://github.com/PetarStoev02/talyx-app/issues/new'

export type FeedbackType = 'bug' | 'idea' | 'other'

export interface IssueDraft {
  type: FeedbackType
  message: string
  appVersion: string
  systemVersion: string
}

const TITLE_PREFIX: Record<FeedbackType, string> = { bug: 'Bug', idea: 'Idea', other: 'Feedback' }
const TITLE_MAX_CHARS = 60
/** GitHub rejects issue URLs past ~8 KB; Cyrillic percent-encodes to ~6 bytes a character. */
export const MAX_BODY_CHARS = 1000
const CUT_NOTICE = '\n\n(cut — paste the rest here)'

/**
 * A prefilled "new issue" page. The user reads it and submits it on GitHub
 * themselves, so Talyx itself sends nothing anywhere.
 */
export function issueUrl(draft: IssueDraft): string {
  const message = draft.message.trim()
  const firstLine = message.replace(/\r\n/g, '\n').split('\n')[0].slice(0, TITLE_MAX_CHARS)
  const text =
    message.length > MAX_BODY_CHARS ? message.slice(0, MAX_BODY_CHARS) + CUT_NOTICE : message
  const params = new URLSearchParams({
    title: `[${TITLE_PREFIX[draft.type]}] ${firstLine}`,
    body: `${text}\n\n---\nTalyx ${draft.appVersion} · macOS ${draft.systemVersion}`
  })
  return `${TALYX_NEW_ISSUE_URL}?${params.toString()}`
}
