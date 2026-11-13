/**
 * What every bot is told about the app it lives in. It goes into each profile's own prompt
 * setting (`agent.system_prompt`), which the engine adds to the bot's instructions; the SOUL stays
 * the user's. Changing this text rewrites it on every bot at the next start.
 */
export const TALYX_RULES = [
  '# Talyx',
  '',
  'Talyx is the desktop app you live in. The user sees you in a roster of bots, with folders and pins, and chats with you there.',
  'The other bots in the roster are your teammates, and Talyx is also the name of the manager bot.',
  'When the user says "the app" or "Talyx", they mean this app.',
  'To change Talyx itself (create, rename or delete bots, folders and rooms, pin them, change a bot\u2019s settings or routines), use the tools of the `talyx` MCP server; never edit its files. Deleting asks the user in Talyx first.'
].join('\n')

/**
 * Every earlier version of TALYX_RULES. When the text changes in a release, the old text moves
 * here, so a bot that still holds it is rewritten; any other prompt is the user's own.
 */
export const PREVIOUS_RULES: string[] = [
  [
    '# Talyx',
    '',
    'Talyx is the desktop app you live in. The user sees you in a roster of bots, with folders and pins, and chats with you there.',
    'The other bots in the roster are your teammates, and Talyx is also the name of the manager bot.',
    'When the user says "the app" or "Talyx", they mean this app.'
  ].join('\n')
]

export interface RulesBackend {
  /** The profile's own prompt setting, as written: absent, a string or (the engine allows) a list. */
  readPrompt: (profile: string) => Promise<unknown>
  writePrompt: (profile: string, prompt: string) => Promise<void>
}

/**
 * Writes the rules into the profile's prompt setting when it is empty (or blank) or holds an earlier Talyx
 * text. A prompt the user wrote is left alone.
 */
export async function writeRules(backend: RulesBackend, profile: string): Promise<void> {
  const prompt = await backend.readPrompt(profile)
  if (prompt === TALYX_RULES) return
  // The engine also takes a list here; like any prompt that is not a Talyx text, it is the user's.
  // A blank string or an empty list holds nothing of theirs.
  const empty =
    !prompt ||
    (typeof prompt === 'string' && !prompt.trim()) ||
    (Array.isArray(prompt) && !prompt.length)
  if (!empty && !(typeof prompt === 'string' && PREVIOUS_RULES.includes(prompt))) return
  await backend.writePrompt(profile, TALYX_RULES)
}

/** Fills the rules in on every bot; returns the bots that did not take them. */
export async function fillInRules(backend: RulesBackend, profiles: string[]): Promise<string[]> {
  const results = await Promise.allSettled(profiles.map((profile) => writeRules(backend, profile)))
  return profiles.filter((_, index) => results[index].status === 'rejected')
}
