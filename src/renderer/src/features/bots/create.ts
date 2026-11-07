import type { TranslationKey } from '@shared/lib/i18n'
import { saveBotMeta } from './data'
import type { RosterBackend } from './data'
import { confirmBotModel } from './details'
import type { ModelChoice } from './details'
import { exportAvatar, lookMeta } from './look'
import type { Look } from './look'
import { RosterError, problemOf } from './roster'
import { writeRules } from './rules'
import type { Folder } from './types'

export interface NewBot {
  name: string
  folder: Folder | null
  /** Null leaves the model the engine gives a new profile: Talyx's own. */
  model: ModelChoice | null
  look: Look
  /** What the bot does, written into its SOUL. Blank counts as none. */
  purpose: string | null
}

/** The profile exists but a step after creating it failed; `profile` is its id. */
export class IncompleteBotError extends RosterError {
  constructor(
    readonly profile: string,
    key: TranslationKey,
    detail: string | null
  ) {
    super(key, detail)
    this.name = 'IncompleteBotError'
  }
}

// The engine's profile id rule: it is also the profile's folder name on disk.
const PROFILE_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/
const MAX_ID_LENGTH = 64

/** The profile id for a typed name. A name with no Latin letters or digits gets `bot-N`. */
export function profileIdFor(name: string, taken: string[]): string {
  const slug = name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_ID_LENGTH)
    .replace(/-+$/, '')
  if (PROFILE_ID.test(slug)) {
    if (taken.includes(slug)) throw new RosterError('create.errorTaken')
    return slug
  }
  let n = 1
  while (taken.includes(`bot-${n}`)) n++
  return `bot-${n}`
}

/**
 * Creates the profile, pins its model, files it with its title and look, exports the look, then
 * tells it about Talyx.
 * Returns its id. The model goes through the same pin as the details panel's: the pick was made
 * in the form, so a costly one is not asked about again.
 */
export async function createBot(
  backend: RosterBackend,
  bot: NewBot,
  taken: string[]
): Promise<string> {
  const id = profileIdFor(bot.name, taken)
  const title = bot.name.trim()
  await backend.request('default', 'profiles.create', {
    name: id,
    soul: soulFor(title, id, bot.purpose?.trim() || null)
  })
  try {
    if (bot.model) await confirmBotModel(backend, id, bot.model)
  } catch (error) {
    throw new IncompleteBotError(id, 'create.errorModel', problemOf(error).detail)
  }
  try {
    await saveBotMeta(backend, id, {
      title,
      sectionId: bot.folder?.id ?? null,
      sectionName: bot.folder?.name ?? null,
      ...lookMeta(bot.look)
    })
  } catch (error) {
    throw new IncompleteBotError(id, 'create.errorNotFiled', problemOf(error).detail)
  }
  try {
    await exportAvatar(backend, id, bot.look)
  } catch (error) {
    throw new IncompleteBotError(id, 'create.errorNoAvatar', problemOf(error).detail)
  }
  try {
    await writeRules(backend, id)
  } catch (error) {
    throw new IncompleteBotError(id, 'create.errorRules', problemOf(error).detail)
  }
  return id
}

// The engine adds the teammate-messaging protocol itself; the SOUL only says who the bot is.
function soulFor(title: string, id: string, purpose: string | null): string {
  const soul = [
    `# ${title}`,
    '',
    `You are ${title}, a persistent named agent (profile \`${id}\`) on this machine.`,
    'You keep your own memory, skills, and conversation history across sessions.'
  ].join('\n')
  return purpose ? `${soul}\n\nWhat you do: ${purpose}` : soul
}
