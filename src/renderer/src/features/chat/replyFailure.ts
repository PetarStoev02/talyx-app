import { hideEngineName } from '@shared/lib/engineName'

// The engine's failure for a bot with no model provider. Its wording sends the user to the
// engine's own commands and files; Talyx has its own place for providers.
const NO_PROVIDER = /not connected to any AI provider/i

/** What a failed reply says under "This reply did not finish". */
export type ReplyFailure = { kind: 'noProvider' } | { kind: 'engine'; text: string }

/** The engine's failure text as Talyx shows it; `engineName` is the attached engine's own name. */
export function replyFailure(error: string, engineName: string | null): ReplyFailure {
  return NO_PROVIDER.test(error)
    ? { kind: 'noProvider' }
    : { kind: 'engine', text: hideEngineName(error, engineName) }
}
