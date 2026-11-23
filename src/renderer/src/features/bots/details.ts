import { saveBotMeta } from './data'
import type { RosterStore } from './data'
import { exportAvatar, lookMeta, sameLook } from './look'
import type { AvatarBackend, Look } from './look'
import { problemOf } from '@shared/lib/problem'
import type { Problem } from '@shared/lib/problem'
import { MANAGER_TITLE, RosterError, checkedName } from './roster'
import type { Bot, BotMeta } from './types'
import { useDetailsRevision } from './store'

export interface ModelChoice {
  provider: string
  model: string
}

/** What the engine keeps for a profile, as the details panel edits it. */
export interface ProfileDetails {
  description: string
  soul: string
  model: ModelChoice | null
}

export interface DetailsDraft extends ProfileDetails {
  title: string
  look: Look
  /** On "Uses default": `model` is Talyx's, and the bot moves when Talyx's model changes. */
  usesDefault: boolean
}

/** A details edit: the fields as the panel opened, and as they are now. */
export interface DetailsChange {
  opening: DetailsDraft
  draft: DetailsDraft
}

/** The engine wants a yes before it pins this model; nothing else is waiting on it. */
export interface ModelConfirm {
  message: string
  model: ModelChoice
}

/**
 * The profile sections the engine refused in one save, by their engine names. `reason` is what the
 * engine said about a refused model, when it said something.
 */
export class SectionsNotSavedError extends RosterError {
  constructor(
    readonly sections: string[],
    readonly reason: string | null = null
  ) {
    super('details.errorNotApplied', sections.join(', '))
    this.name = 'SectionsNotSavedError'
  }
}

/** A profile's details and its model on the engine. */
export interface DetailsBackend {
  loadDetails: (profile: string) => Promise<ProfileDetails>
  /** Saves description and SOUL in one call; a `SectionsNotSavedError` names the refused ones. */
  saveSections: (
    profile: string,
    sections: Partial<Pick<ProfileDetails, 'description' | 'soul'>>
  ) => Promise<void>
  /**
   * Pins the bot's model. For a costly model the engine saves nothing and asks first: the question
   * comes back. A refusal is a `SectionsNotSavedError` for `model`.
   */
  pinModel: (profile: string, pick: ModelChoice) => Promise<ModelConfirm | null>
  /** Pins the bot's model, its cost already agreed to. */
  pinAgreedModel: (profile: string, pick: ModelChoice) => Promise<void>
}

type SaveBackend = DetailsBackend & Pick<RosterStore, 'saveBotMeta'> & AvatarBackend

/** Talyx's own profile, the manager. Its avatar is the logo, so it never gets an exported image. */
export const MANAGER = 'default'

/**
 * Stores the manager bot's title where the engine reads a bot's friendly name. Without it the
 * engine signs what the manager hands another bot with its own handle, and that bot then calls the
 * manager by a name the user never sees. True when the title was written.
 */
export async function nameManager(
  backend: Pick<RosterStore, 'saveBotMeta'>,
  bot: Bot
): Promise<boolean> {
  if (bot.name !== MANAGER || bot.meta.title === MANAGER_TITLE) return false
  await saveBotMeta(backend, MANAGER, { title: MANAGER_TITLE })
  return true
}

export function loadDetails(
  backend: Pick<DetailsBackend, 'loadDetails'>,
  profile: string
): Promise<ProfileDetails> {
  return backend.loadDetails(profile)
}

function detailsChanged(): void {
  useDetailsRevision.setState(({ revision }) => ({ revision: revision + 1 }))
}

/**
 * Title and look go to the bot's metadata; description, SOUL and model to the profile, only if
 * changed. A new look is exported as the profile's avatar image first, so a failed export saves
 * nothing and Save stays there to retry. Talyx is always the logo: only its face is its own.
 */
export async function saveDetails(
  backend: SaveBackend,
  bot: Bot,
  change: DetailsChange
): Promise<ModelConfirm | null> {
  // Even a save that fails part way may have changed some of them.
  try {
    return await saveAll(backend, bot, change)
  } finally {
    detailsChanged()
  }
}

/**
 * Whether saving the change writes anything besides the model. Those fields are saved before the
 * model's cost is asked, so a no to the model must not say nothing changed.
 */
export function savesBesidesModel(bot: Bot, change: DetailsChange): boolean {
  return (
    Object.keys(metaChange(bot, change)).length > 0 ||
    Object.keys(sectionsChange(change)).length > 0
  )
}

async function saveAll(
  backend: SaveBackend,
  bot: Bot,
  change: DetailsChange
): Promise<ModelConfirm | null> {
  checkedName(change.draft.title)
  if (bot.name !== MANAGER && lookChanged(bot, change))
    await exportAvatar(backend, bot.name, change.draft.look)
  const meta = metaChange(bot, change)
  if (Object.keys(meta).length > 0) await saveBotMeta(backend, bot.name, meta)

  const leaving = leavesDefault(change)
  const leave = (): Promise<void> =>
    leaving ? leaveDefaultIfPinned(backend, bot.name, leaving) : Promise.resolve()
  const confirm = await saveSections(backend, bot.name, change).catch(async (error: unknown) => {
    // A refused section does not stop the model's pin; the refusal stays the error reported.
    await leave().catch(() => undefined)
    throw error
  })
  await leave()
  return confirm
}

function lookChanged(bot: Bot, { opening, draft }: DetailsChange): boolean {
  return bot.name === MANAGER
    ? draft.look.faces !== opening.look.faces
    : !sameLook(draft.look, opening.look)
}

function metaChange(bot: Bot, change: DetailsChange): Partial<BotMeta> {
  const { opening, draft } = change
  const look = lookMeta(draft.look)
  const meta: Partial<BotMeta> = !lookChanged(bot, change)
    ? {}
    : bot.name === MANAGER
      ? { faces: look.faces }
      : look
  if (draft.title.trim() !== opening.title.trim()) meta.title = draft.title.trim()
  // Absent rather than false, as on every bot made before this choice.
  if (draft.usesDefault !== opening.usesDefault && !leavesDefault(change))
    meta.usesDefault = draft.usesDefault || null
  // An older client's description in the metadata would hide the one saved on the profile.
  if (draft.description.trim() !== opening.description.trim() && bot.meta.description !== null)
    meta.description = null
  return meta
}

function sectionsChange({
  opening,
  draft
}: DetailsChange): Partial<Pick<ProfileDetails, 'description' | 'soul'>> {
  const sections: Partial<Pick<ProfileDetails, 'description' | 'soul'>> = {}
  if (draft.description.trim() !== opening.description.trim())
    sections.description = draft.description.trim()
  if (draft.soul !== opening.soul) sections.soul = draft.soul
  return sections
}

// The model a bot on Uses default picks as its own, or null. It leaves Uses default only once
// that model is pinned: a no to a costly one keeps it following.
function leavesDefault({ opening, draft }: DetailsChange): ModelChoice | null {
  return opening.usesDefault &&
    !draft.usesDefault &&
    draft.model &&
    !sameModelChoice(draft.model, opening.model)
    ? draft.model
    : null
}

// The engine's pin is the fact: the bot leaves Uses default once its own model is on it.
async function leaveDefaultIfPinned(
  backend: Pick<DetailsBackend, 'loadDetails'> & Pick<RosterStore, 'saveBotMeta'>,
  profile: string,
  model: ModelChoice
): Promise<void> {
  const pinned = (await loadDetails(backend, profile)).model
  if (pinned && sameModelChoice(pinned, model))
    await saveBotMeta(backend, profile, { usesDefault: null })
}

export async function confirmModel(
  backend: Pick<DetailsBackend, 'pinAgreedModel'> & Pick<RosterStore, 'saveBotMeta'>,
  profile: string,
  model: ModelChoice
): Promise<void> {
  try {
    await confirmBotModel(backend, profile, model)
    // A confirmed model is the bot's own pick, so the bot no longer follows Talyx's.
    if (profile !== MANAGER) await saveBotMeta(backend, profile, { usesDefault: null })
  } finally {
    detailsChanged()
  }
}

/**
 * Pins the bot's model. For a costly model the engine saves nothing and asks first: the question
 * comes back, `confirmBotModel` answers it. A refusal is a `SectionsNotSavedError` for `model`.
 */
export function setBotModel(
  backend: Pick<DetailsBackend, 'pinModel'>,
  profile: string,
  pick: ModelChoice
): Promise<ModelConfirm | null> {
  return backend.pinModel(profile, pick)
}

/** Pins the bot's model after the user said yes to its cost. */
export function confirmBotModel(
  backend: Pick<DetailsBackend, 'pinAgreedModel'>,
  profile: string,
  pick: ModelChoice
): Promise<void> {
  return backend.pinAgreedModel(profile, pick)
}

// Description and SOUL go in one configure call, the model through its own pin; a refusal of
// either does not stop the other, and every refused section is reported together.
async function saveSections(
  backend: Pick<DetailsBackend, 'saveSections' | 'pinModel' | 'pinAgreedModel'>,
  profile: string,
  change: DetailsChange
): Promise<ModelConfirm | null> {
  const { opening, draft } = change
  const sections = sectionsChange(change)
  const model = draft.model && !sameModelChoice(draft.model, opening.model) ? draft.model : null
  const refused: string[] = []
  let reason: string | null = null
  const refusing = (error: unknown): null => {
    if (!(error instanceof SectionsNotSavedError)) throw error
    refused.push(...error.sections)
    reason ??= error.reason
    return null
  }
  if (Object.keys(sections).length > 0)
    await backend.saveSections(profile, sections).catch(refusing)
  const confirm = model ? await pinModel(backend, profile, { model, draft }).catch(refusing) : null
  if (refused.length > 0) throw new SectionsNotSavedError(refused, reason)
  return confirm
}

// Talyx's model was agreed to when it was picked, a costly one included: a bot that follows it
// is not asked again.
async function pinModel(
  backend: Pick<DetailsBackend, 'pinModel' | 'pinAgreedModel'>,
  profile: string,
  { model, draft }: { model: ModelChoice; draft: DetailsDraft }
): Promise<ModelConfirm | null> {
  if (!draft.usesDefault) return setBotModel(backend, profile, model)
  await confirmBotModel(backend, profile, model)
  return null
}

/**
 * Moves every bot on "Uses default" to Talyx's new model, without asking about its cost again;
 * returns the bots that did not take it. A bot with its own model keeps it.
 */
export async function followDefault(
  backend: Pick<DetailsBackend, 'pinAgreedModel'> & Pick<RosterStore, 'listBots'>,
  pick: ModelChoice
): Promise<string[]> {
  const bots = await backend.listBots().catch((error: unknown) => {
    // Talyx's model has changed by now: say the followers were not reached, not that it failed.
    throw new RosterError('details.errorFollowersUnreached', problemOf(error).detail)
  })
  const followers = bots
    .filter((bot) => bot.meta.usesDefault === true && bot.name !== MANAGER)
    .map((bot) => bot.name)
  try {
    const unreached = await Promise.all(
      followers.map((profile) =>
        confirmBotModel(backend, profile, pick).then(
          () => [],
          () => [profile]
        )
      )
    )
    return unreached.flat()
  } finally {
    detailsChanged()
  }
}

/**
 * After a save that may have changed Talyx's model, in part or after a refusal: reads the model
 * Talyx has now and moves the followers when it differs from `before`.
 */
export async function followIfDefaultChanged(
  backend: Pick<DetailsBackend, 'loadDetails' | 'pinAgreedModel'> & Pick<RosterStore, 'listBots'>,
  before: ModelChoice | null
): Promise<string[]> {
  const { model } = await loadDetails(backend, MANAGER)
  return model && !sameModelChoice(model, before) ? followDefault(backend, model) : []
}

export function sameModelChoice(a: ModelChoice, b: ModelChoice | null): boolean {
  return a.provider === b?.provider && a.model === b.model
}

/**
 * What a refused section tells the user, shown under its field. For description and SOUL the
 * engine says only that the section was not applied, so the message gives the likeliest reason;
 * a refused model also shows the engine's own words.
 */
export function refusedSectionProblem(section: string, reason: string | null = null): Problem {
  if (section === 'model') return { key: 'details.errorModel', detail: reason }
  if (section === 'description') return { key: 'details.errorDescription', detail: null }
  if (section === 'soul') return { key: 'details.errorSoul', detail: null }
  return { key: 'details.errorNotApplied', detail: section }
}
