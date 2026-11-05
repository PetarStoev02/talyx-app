import type { TranslationKey } from '@shared/lib/i18n'
import { saveBotMeta } from './data'
import type { RosterBackend } from './data'
import type { ModelChoice } from './details'
import { exportAvatar, lookMeta } from './look'
import type { Look } from './look'
import { RosterError, problemOf } from './roster'
import type { Folder } from './types'

export interface NewBot {
  name: string
  folder: Folder | null
  /** Null leaves the model the engine gives a new profile. */
  model: ModelChoice | null
  look: Look
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

/** Creates the profile, files it with its title and look, then exports the look. Returns its id. */
export async function createBot(
  backend: RosterBackend,
  bot: NewBot,
  taken: string[]
): Promise<string> {
  const id = profileIdFor(bot.name, taken)
  const title = bot.name.trim()
  await backend.request('default', 'profiles.create', {
    name: id,
    soul: soulFor(title, id),
    ...(bot.model ? { model: bot.model.model, provider: bot.model.provider } : {})
  })
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
  return id
}

// The engine adds the teammate-messaging protocol itself; the SOUL only says who the bot is.
function soulFor(title: string, id: string): string {
  return [
    `# ${title}`,
    '',
    `You are ${title}, a persistent named agent (profile \`${id}\`) on this machine.`,
    'You keep your own memory, skills, and conversation history across sessions.'
  ].join('\n')
}
