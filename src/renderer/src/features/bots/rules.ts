import type { RosterBackend } from './data'

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
  'When the user says "the app" or "Talyx", they mean this app.'
].join('\n')

/**
 * Every earlier version of TALYX_RULES. When the text changes in a release, the old text moves
 * here, so a bot that still holds it is rewritten; any other prompt is the user's own.
 */
export const PREVIOUS_RULES: string[] = []

interface ProfileConfig {
  agent?: { system_prompt?: unknown }
}

/**
 * Writes the rules into the profile's prompt setting when it is empty or holds an earlier Talyx
 * text. A prompt the user wrote is left alone.
 */
export async function writeRules(backend: RosterBackend, profile: string): Promise<void> {
  const path = `/api/config?${new URLSearchParams({ profile })}`
  const config = await backend.http<ProfileConfig>({
    path: `${path}&include_defaults=false`,
    profile
  })
  const prompt = config.agent?.system_prompt
  if (prompt === TALYX_RULES) return
  // The engine also takes a list here; like any prompt that is not a Talyx text, it is the user's.
  if (prompt && !(typeof prompt === 'string' && PREVIOUS_RULES.includes(prompt))) return
  await backend.http({
    path,
    method: 'PUT',
    body: { config: { agent: { system_prompt: TALYX_RULES } } },
    profile
  })
}

/** Fills the rules in on every bot; returns the bots that did not take them. */
export async function fillInRules(backend: RosterBackend, profiles: string[]): Promise<string[]> {
  const results = await Promise.allSettled(profiles.map((profile) => writeRules(backend, profile)))
  return profiles.filter((_, index) => results[index].status === 'rejected')
}
