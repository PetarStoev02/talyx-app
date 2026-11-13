import { BARE_CUSTOM, namedTwinOfBare, sameBaseUrl } from '@shared/engine/endpoints'
import type { ModelOptionProvider } from '@shared/engine/gateway-events'
import type { CustomEndpoint, SessionMessage } from '@shared/engine/types'
import { MediaGoneError } from '@features/chat/chat'
import type { ChatBackend, ChatDraft, ResumeSnapshot } from '@features/chat/chat'
import type { EngineAccess } from './access'

/** The bot's chat is the profile's hidden session with this exact title. */
const BOT_CHAT_TITLE = 'Bot Chat'
// The most messages the engine sends in one page of a transcript.
const ENGINE_PAGE_MAX = 500
const TITLE_TAKEN = 'already in use'
// A stored message's id is its durable row id; a message not stored yet has a local one.
const ROW_ID = /^\d+$/

/** The chat's backend over the engine. */
export function engineChatBackend(engine: EngineAccess): ChatBackend {
  async function findChat(profile: string): Promise<string | null> {
    const { sessions } = await engine.request<{
      sessions: Array<{ id: string; resolved_id?: string | null }>
    }>(profile, 'session.list', { title: BOT_CHAT_TITLE, limit: 200, include_hidden: true })
    const row = sessions[0]
    return row ? row.resolved_id || row.id : null
  }

  async function messages(
    profile: string,
    chatId: string,
    query: Record<string, string>
  ): Promise<SessionMessage[]> {
    const search = new URLSearchParams({ profile, ...query })
    const page = await engine.http<{ messages: SessionMessage[] }>({
      path: `/api/sessions/${encodeURIComponent(chatId)}/messages?${search}`,
      profile
    })
    return page.messages
  }

  function historyPage(
    profile: string,
    chatId: string,
    page: { limit: number; order: 'latest' | 'oldest'; offset: number }
  ): Promise<SessionMessage[]> {
    return messages(profile, chatId, {
      limit: String(page.limit),
      order: page.order,
      offset: String(page.offset),
      include_compacted: 'true'
    })
  }

  // ponytail: while the search is open, each reload reads every page; a very long chat would want
  // only the new pages.
  async function wholeHistory(profile: string, chatId: string): Promise<SessionMessage[]> {
    const all: SessionMessage[] = []
    for (;;) {
      const page = await historyPage(profile, chatId, {
        limit: ENGINE_PAGE_MAX,
        order: 'oldest',
        offset: all.length
      })
      all.push(...page)
      if (page.length < ENGINE_PAGE_MAX) return all
    }
  }

  const configure = async (
    profile: string,
    chatId: string,
    setting: { key: string; value: string }
  ): Promise<void> => {
    await engine.request(profile, 'config.set', { session_id: chatId, ...setting })
  }

  return {
    findChat,

    createChat: async (profile) => {
      const { session_id: created } = await engine.request<{ session_id: string }>(
        profile,
        'session.create',
        { title: BOT_CHAT_TITLE, hidden: true, follow_profile_config: true }
      )
      try {
        await engine.request(profile, 'session.title', {
          session_id: created,
          title: BOT_CHAT_TITLE
        })
        return created
      } catch (error) {
        // Another client created the Bot Chat first: use that one.
        const winner = error instanceof Error && error.message.includes(TITLE_TAKEN)
        const existing = winner ? await findChat(profile) : null
        if (!existing) throw error
        return existing
      }
    },

    history: (profile, chatId, limit) =>
      limit === null
        ? wholeHistory(profile, chatId)
        : historyPage(profile, chatId, { limit, order: 'latest', offset: 0 }),

    newestMessages: (profile, chatId, limit) =>
      messages(profile, chatId, { limit: String(limit), order: 'latest' }),

    resume: (profile, chatId) =>
      engine.request<ResumeSnapshot>(profile, 'session.resume', {
        session_id: chatId,
        defer_history: true,
        omit_messages: true
      }),

    submit: async (profile, chatId, draft) => {
      await engine.request(profile, 'prompt.submit', submitParams(chatId, draft))
    },

    interrupt: async (profile, chatId) => {
      await engine.request(profile, 'session.interrupt', { session_id: chatId })
    },

    setModel: (profile, chatId, { model, provider }) =>
      configure(profile, chatId, { key: 'model', value: `${model} --provider ${provider}` }),

    setReasoning: (profile, chatId, level) =>
      configure(profile, chatId, { key: 'reasoning', value: level }),

    answerQuestion: async (profile, promptId, { id, answer }) => {
      await engine.request(profile, 'clarify.lock', {
        request_id: promptId,
        question_id: id,
        answer: Array.isArray(answer) ? JSON.stringify(answer) : answer
      })
    },

    models: (profile) => loadModels(engine, profile),

    uploadImage: async (profile, { dataUrl, name }) => {
      const { path, mime_type: mime } = await engine.http<{ path: string; mime_type: string }>({
        path: `/api/chat/image-upload?profile=${encodeURIComponent(profile)}`,
        method: 'POST',
        body: { data_url: dataUrl, filename: name },
        profile
      })
      return { path, mime }
    },

    transcribe: async (profile, { dataUrl, mime }) => {
      const { transcript } = await engine.http<{ transcript: string }>({
        path: `/api/audio/transcribe?profile=${encodeURIComponent(profile)}`,
        method: 'POST',
        body: { data_url: dataUrl, mime_type: mime },
        profile
      })
      return transcript
    },

    mediaUrl: async (profile, path) => {
      const query = new URLSearchParams({ path, profile })
      // Null when the engine no longer has the file; the chat then shows its name.
      const media = await engine.http<{ data_url: string } | null>({
        path: `/api/media?${query}`,
        profile
      })
      if (!media) throw new MediaGoneError(path)
      return media.data_url
    }
  }
}

function submitParams(chatId: string, draft: ChatDraft): Record<string, unknown> {
  return {
    session_id: chatId,
    text: draft.text,
    ...(draft.images.length ? { attachments: draft.images } : {}),
    ...(draft.whenBusy === 'queue' ? { queued: true } : {}),
    // Only a stored message can be cut: one the engine never stored is sent again as new.
    ...(draft.replaces && ROW_ID.test(draft.replaces)
      ? { truncate_before_row_id: Number(draft.replaces), confirm_truncate: true }
      : {})
  }
}

async function loadModels(engine: EngineAccess, profile: string): Promise<ModelOptionProvider[]> {
  const query = new URLSearchParams({ explicit_only: '1', profile })
  const [{ providers }, { endpoints }] = await Promise.all([
    engine.http<{ providers: ModelOptionProvider[] }>({
      path: `/api/model/options?${query}`,
      profile
    }),
    engine
      .http<{ endpoints?: CustomEndpoint[] }>({
        path: `/api/providers/custom-endpoints?${new URLSearchParams({ profile })}`,
        profile
      })
      // The saved lists only narrow the picker: without them it shows every model offered.
      .catch(() => ({ endpoints: [] }))
  ])
  return withoutBareTwin(providers, endpoints ?? []).map((provider) =>
    withSavedModels(provider, endpoints ?? [])
  )
}

/**
 * Talyx keeps its bare custom endpoint as a named one too (see keepBareEndpoint), which would list
 * the same URL twice. The bare row goes and the named row stands for it, so a bot still on the
 * bare provider shows its model as selected there.
 */
function withoutBareTwin(
  providers: ModelOptionProvider[],
  endpoints: CustomEndpoint[]
): ModelOptionProvider[] {
  const twin = namedTwinOfBare(endpoints)
  if (!twin || !providers.some((provider) => provider.slug === twin.id)) return providers
  return providers.flatMap((provider) => {
    if (provider.slug === BARE_CUSTOM) return []
    if (provider.slug !== twin.id) return [provider]
    return [{ ...provider, aliases: [...(provider.aliases ?? []), BARE_CUSTOM] }]
  })
}

/**
 * A custom endpoint offers the models saved on it. A router that also lists every model behind it
 * would otherwise fill the picker with routes that skip its fallback.
 */
function withSavedModels(
  provider: ModelOptionProvider,
  endpoints: CustomEndpoint[]
): ModelOptionProvider {
  const url = provider.is_user_defined ? (provider.api_url ?? '') : ''
  const endpoint = url && endpoints.find((item) => sameBaseUrl(item.base_url, url))
  return endpoint && endpoint.models.length > 0
    ? { ...provider, models: endpoint.models }
    : provider
}
