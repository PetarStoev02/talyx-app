import { beforeEach, describe, expect, it } from 'vitest'
import {
  ProvidersError,
  canRemoveEndpoint,
  confirmDefaultModel,
  cancelSignIn,
  checkEndpoint,
  checkKey,
  disconnectAccount,
  loadProviders,
  removeEndpoint,
  removeKey,
  revealKey,
  saveEndpoint,
  saveKey,
  setDefaultModel,
  startSignIn,
  submitSignInCode,
  waitForSignIn
} from '../../../src/renderer/src/features/providers/providers'
import type { EndpointDraft } from '../../../src/renderer/src/features/providers/providers'
import { HOME, ROUTER, providersDouble } from './providersDouble'
import type { ProvidersDouble } from './providersDouble'

const routerDraft = (patch: Partial<EndpointDraft> = {}): EndpointDraft => ({
  editing: ROUTER,
  name: ROUTER.name,
  baseUrl: ROUTER.base_url,
  apiKey: 'sk-router',
  models: ['9-route-provider'],
  ...patch
})

describe('providers', () => {
  let engine: ProvidersDouble

  beforeEach(() => {
    engine = providersDouble()
  })

  describe('loadProviders', () => {
    it('should show the router as the active endpoint and Talyx on its combo', async () => {
      const overview = await loadProviders(engine.backend)

      expect(overview.endpoints).toEqual([ROUTER])
      expect(overview.model).toEqual({ provider: 'custom', model: '9-route-provider' })
    })

    it('should list the router once when Talyx also keeps it as a named endpoint', async () => {
      const kept = {
        ...ROUTER,
        id: 'endpoint-127-0-0-1-20128',
        name: 'Custom endpoint (127.0.0.1:20128)',
        base_url: `${ROUTER.base_url}/`,
        is_current: false,
        source: 'providers'
      }
      const other = { ...kept, id: 'lab', name: 'Lab', base_url: 'http://10.0.0.2:8000/v1' }
      engine.profiles[HOME].endpoints.push(kept, other)

      const { endpoints } = await loadProviders(engine.backend)

      expect(endpoints.map((endpoint) => endpoint.id)).toEqual(['custom', 'lab'])
    })

    it('should list one key per provider, a shared key under each of its routes', async () => {
      const { keys } = await loadProviders(engine.backend)

      expect(keys.map((slot) => [slot.provider, slot.key])).toEqual([
        ['OpenAI API', 'OPENAI_API_KEY'],
        ['Z.AI (GLM)', 'GLM_API_KEY'],
        ['Qwen Cloud', 'DASHSCOPE_API_KEY'],
        ['Alibaba Cloud', 'DASHSCOPE_API_KEY']
      ])
      expect(keys[0]).toMatchObject({ docsUrl: 'https://openai.example/keys', preview: null })
    })

    it("should show a saved key only as the engine's masked preview", async () => {
      engine.profiles[HOME].env.OPENAI_API_KEY = 'sk-secret-value'

      const { keys } = await loadProviders(engine.backend)

      expect(keys[0].preview).toBe('sk-…')
      expect(JSON.stringify(keys)).not.toContain('secret-value')
    })

    it('should tell signed-in accounts and ones another tool owns apart', async () => {
      engine.accounts[0].status = { logged_in: true, free_tier: true }

      const { accounts } = await loadProviders(engine.backend)

      expect(accounts).toEqual([
        expect.objectContaining({ id: 'openai-codex', signedIn: false, disconnectable: true }),
        expect.objectContaining({ id: 'xai-oauth', signedIn: false, flow: 'pkce' }),
        expect.objectContaining({
          id: 'claude-code',
          signedIn: true,
          disconnectable: false,
          command: 'acme auth add claude-code'
        }),
        expect.objectContaining({ id: 'qwen-oauth', signedIn: false, flow: 'external' })
      ])
    })
  })

  describe('keys', () => {
    it('should save a key on Talyx first, then on every other bot', async () => {
      const failed = await saveKey(engine.backend, { key: 'OPENAI_API_KEY', value: ' sk-new ' })

      expect(failed).toEqual([])
      expect(engine.writes).toEqual([
        'default PUT /api/env',
        'analyst PUT /api/env',
        'writer PUT /api/env'
      ])
      for (const profile of Object.values(engine.profiles))
        expect(profile.env.OPENAI_API_KEY).toBe('sk-new')
    })

    it('should name the bots that did not take the key', async () => {
      engine.failOn('writer')

      expect(await saveKey(engine.backend, { key: 'OPENAI_API_KEY', value: 'sk-new' })).toEqual([
        'writer'
      ])
      expect(engine.profiles.analyst.env.OPENAI_API_KEY).toBe('sk-new')
    })

    it('should leave every bot alone when Talyx refuses the key', async () => {
      engine.failOn(HOME)

      await expect(
        saveKey(engine.backend, { key: 'OPENAI_API_KEY', value: 'sk-new' })
      ).rejects.toThrow('HTTP 500')
      expect(engine.writes).toEqual([])
    })

    it('should refuse a blank key without calling the engine', () => {
      expect(() => saveKey(engine.backend, { key: 'OPENAI_API_KEY', value: '  ' })).toThrow(
        ProvidersError
      )
      expect(engine.writes).toEqual([])
    })

    it('should reveal a key only from Talyx and remove it from every bot', async () => {
      await saveKey(engine.backend, { key: 'OPENAI_API_KEY', value: 'sk-new' })

      expect(await revealKey(engine.backend, 'OPENAI_API_KEY')).toBe('sk-new')
      expect(engine.writes.at(-1)).toBe('default POST /api/env/reveal')

      expect(await removeKey(engine.backend, 'OPENAI_API_KEY')).toEqual([])
      for (const profile of Object.values(engine.profiles)) expect(profile.env).toEqual({})
    })

    it('should count a bot that never had the key as done when the key is removed', async () => {
      engine.profiles[HOME].env.OPENAI_API_KEY = 'sk-only-talyx'

      expect(await removeKey(engine.backend, 'OPENAI_API_KEY')).toEqual([])
      expect(engine.profiles[HOME].env).toEqual({})
    })

    it('should name a bot that still has the key after a failed removal', async () => {
      await saveKey(engine.backend, { key: 'OPENAI_API_KEY', value: 'sk-new' })
      engine.failOn('writer')

      expect(await removeKey(engine.backend, 'OPENAI_API_KEY')).toEqual(['writer'])
      expect(engine.profiles.writer.env.OPENAI_API_KEY).toBe('sk-new')
    })

    it.each([
      ['sk-good', { verdict: 'works', message: '' }],
      ['bad', { verdict: 'rejected', message: 'Key rejected' }],
      ['offline', { verdict: 'unchecked', message: '' }]
    ] as const)("should report the provider's answer for the key %s", async (value, answer) => {
      expect(await checkKey(engine.backend, { key: 'OPENAI_API_KEY', value })).toEqual(answer)
    })
  })

  describe('custom endpoints', () => {
    it('should save the listed models on every bot without changing any bot model', async () => {
      const draft = routerDraft({ models: ['9-route-provider', ' fast ', '9-route-provider', ''] })

      expect(await saveEndpoint(engine.backend, draft)).toEqual([])

      for (const profile of Object.values(engine.profiles)) {
        expect(profile.endpoints).toEqual([
          expect.objectContaining({ id: 'custom', models: ['9-route-provider', 'fast'] })
        ])
        expect(profile.model).toEqual({ provider: 'custom', model: '9-route-provider' })
      }
      expect(engine.bodies['POST /api/providers/custom-endpoints']).toEqual({
        id: 'custom',
        name: 'Custom',
        base_url: ROUTER.base_url,
        model: '9-route-provider',
        models: ['9-route-provider', 'fast'],
        api_key: 'sk-router',
        discover_models: true
      })
    })

    it('should refuse to save the config.yaml router unless its key is typed again', async () => {
      expect(() => saveEndpoint(engine.backend, routerDraft({ apiKey: ' ' }))).toThrow(
        expect.objectContaining({ key: 'providers.errorEndpointKeyNeeded' })
      )

      await saveEndpoint(engine.backend, routerDraft())
      const [router] = (await loadProviders(engine.backend)).endpoints
      expect(router).toMatchObject({ source: 'providers', has_api_key: true })
    })

    it('should keep a listed endpoint key when the key field is blank', async () => {
      await saveEndpoint(engine.backend, routerDraft())
      const [router] = (await loadProviders(engine.backend)).endpoints

      await saveEndpoint(engine.backend, routerDraft({ editing: router, apiKey: '' }))

      expect(engine.bodies['POST /api/providers/custom-endpoints']).not.toHaveProperty('api_key')
      expect((await loadProviders(engine.backend)).endpoints[0].has_api_key).toBe(true)
    })

    it('should add a new endpoint under its own name', async () => {
      await saveEndpoint(engine.backend, {
        editing: null,
        name: 'Local',
        baseUrl: 'http://127.0.0.1:8000/v1',
        apiKey: '',
        models: ['qwen3']
      })

      expect(engine.profiles.writer.endpoints.map((endpoint) => endpoint.id)).toEqual([
        'custom',
        'local'
      ])
      expect(engine.bodies['POST /api/providers/custom-endpoints']).not.toHaveProperty('id')
    })

    it.each([
      ['no name', { name: ' ' }, 'providers.errorEndpointIncomplete'],
      ['no base URL', { baseUrl: '' }, 'providers.errorEndpointIncomplete'],
      ['no models', { models: [' ', ''] }, 'providers.errorEndpointNoModels']
    ] as const)('should refuse an endpoint with %s', (_case, patch, key) => {
      expect(() => saveEndpoint(engine.backend, routerDraft(patch))).toThrow(
        expect.objectContaining({ key })
      )
      expect(engine.writes).toEqual([])
    })

    it('should report what a checked endpoint serves', async () => {
      expect(await checkEndpoint(engine.backend, routerDraft({ models: [] }))).toEqual({
        ok: true,
        message: '',
        models: ['a', 'b', 'c']
      })
      expect(engine.writes).toEqual(['default POST /api/providers/custom-endpoints/validate'])
    })

    it('should remove an endpoint only Talyx has without naming the other bots', async () => {
      engine.profiles[HOME].endpoints.push({ ...ROUTER, id: 'local', source: 'providers' })

      expect(await removeEndpoint(engine.backend, 'local')).toEqual([])
      expect(engine.profiles[HOME].endpoints.map((endpoint) => endpoint.id)).toEqual(['custom'])
    })

    it('should remove a listed endpoint from every bot', async () => {
      await saveEndpoint(engine.backend, { ...routerDraft(), editing: null, name: 'Local' })

      expect(await removeEndpoint(engine.backend, 'local')).toEqual([])

      for (const profile of Object.values(engine.profiles))
        expect(profile.endpoints.map((endpoint) => endpoint.id)).toEqual(['custom'])
    })

    it.each([
      ['config.yaml', 'direct-config', false],
      ['listed', 'providers', true]
    ] as const)('should say whether a %s endpoint can be removed', (_case, source, removable) => {
      expect(canRemoveEndpoint({ ...ROUTER, source })).toBe(removable)
    })
  })

  describe('default model', () => {
    it("should set Talyx's model and leave every other bot on its own", async () => {
      expect(
        await setDefaultModel(engine.backend, { provider: 'anthropic', model: 'claude-haiku' })
      ).toBeNull()

      expect(engine.profiles[HOME].model).toEqual({ provider: 'anthropic', model: 'claude-haiku' })
      expect(engine.bodies['POST /api/model/set']).toMatchObject({ scope: 'main' })
      expect(engine.profiles.analyst.model).toEqual({
        provider: 'custom',
        model: '9-route-provider'
      })
    })

    it("should keep Talyx's custom endpoint as a named one before its model leaves it", async () => {
      await setDefaultModel(engine.backend, { provider: 'anthropic', model: 'claude-haiku' })

      expect(engine.writes.slice(0, 2)).toEqual([
        `${HOME} PUT /api/config`,
        `${HOME} POST /api/model/set`
      ])
      expect(engine.bodies['PUT /api/config']).toEqual({
        config: {
          providers: {
            'endpoint-127-0-0-1-20128': {
              name: 'Custom endpoint (127.0.0.1:20128)',
              base_url: ROUTER.base_url,
              model: '9-route-provider',
              models: { '9-route-provider': {} },
              discover_models: true,
              key_env: 'ROUTER_API_KEY'
            }
          }
        }
      })
      expect(engine.profiles[HOME].endpoints.map((endpoint) => endpoint.id)).toEqual([
        'endpoint-127-0-0-1-20128'
      ])
    })

    it('should refuse to leave an endpoint whose key is written into the config', async () => {
      engine.profiles[HOME].endpoints[0].api_key_preview = 'sk-...abcd'
      await expect(
        setDefaultModel(engine.backend, { provider: 'anthropic', model: 'claude-haiku' })
      ).rejects.toMatchObject({ key: 'providers.errorEndpointKeyInConfig' })
      expect(engine.profiles[HOME].model).toEqual({ provider: 'custom', model: '9-route-provider' })
    })

    it('should ask before a costly model and set it only after a yes', async () => {
      const pick = { provider: 'custom', model: 'paid-model' }

      expect(await setDefaultModel(engine.backend, pick)).toEqual({
        message: 'paid-model costs more.',
        model: pick
      })
      expect(engine.profiles[HOME].model.model).toBe('9-route-provider')

      await confirmDefaultModel(engine.backend, pick)
      expect(engine.profiles[HOME].model).toEqual(pick)
    })
  })

  describe('sign-in', () => {
    it('should wait for a device-code sign-in until the browser approves it', async () => {
      const start = await startSignIn(engine.backend, 'openai-codex')
      engine.polls.push('pending', 'approved')

      expect(start).toMatchObject({ flow: 'device_code', user_code: 'ABCD-1234' })
      expect(
        await waitForSignIn(engine.backend, {
          providerId: 'openai-codex',
          sessionId: start.session_id,
          expiresAt: Date.now() + 600_000,
          live: () => true
        })
      ).toEqual({ status: 'approved' })
    })

    it.each(['denied', 'expired'] as const)('should report a sign-in that was %s', async (end) => {
      engine.polls.push(end)

      expect(
        await waitForSignIn(engine.backend, {
          providerId: 'openai-codex',
          sessionId: 's-device',
          expiresAt: Date.now() + 600_000,
          live: () => true
        })
      ).toEqual({ status: 'failed', message: end })
    })

    it('should keep waiting after a poll times out while the sign-in is still open', async () => {
      engine.polls.push('timeout', 'timeout', 'approved')

      expect(
        await waitForSignIn(engine.backend, {
          providerId: 'openai-codex',
          sessionId: 's-device',
          expiresAt: Date.now() + 600_000,
          live: () => true
        })
      ).toEqual({ status: 'approved' })
      expect(engine.polls).toEqual([])
    })

    it('should report the sign-in expired when a poll times out after it expired', async () => {
      engine.polls.push('timeout', 'approved')

      expect(
        await waitForSignIn(engine.backend, {
          providerId: 'openai-codex',
          sessionId: 's-device',
          expiresAt: Date.now() - 1,
          live: () => true
        })
      ).toEqual({ status: 'failed', message: 'expired' })
    })

    it('should not retry a poll that failed for another reason than time', async () => {
      const original = engine.backend.http
      engine.backend.http = async (request) => {
        if (request.path.includes('/poll/')) throw new Error('fetch failed')
        return original(request)
      }

      await expect(
        waitForSignIn(engine.backend, {
          providerId: 'openai-codex',
          sessionId: 's-device',
          expiresAt: Date.now() + 600_000,
          live: () => true
        })
      ).rejects.toThrow('fetch failed')
    })

    it('should stop waiting once the dialog closes', async () => {
      let open = true
      engine.polls.push('pending')
      const wait = waitForSignIn(engine.backend, {
        providerId: 'openai-codex',
        sessionId: 's-device',
        expiresAt: Date.now() + 600_000,
        live: () => open
      })
      open = false

      expect(await wait).toEqual({ status: 'cancelled' })
      await cancelSignIn(engine.backend, 's-device')
      expect(engine.writes.at(-1)).toBe('default DELETE /api/providers/oauth/sessions/s-device')
    })

    it('should finish a pasted-code sign-in only with a code the provider accepts', async () => {
      const sign = { providerId: 'xai-oauth', sessionId: 's-pkce' }

      expect(await submitSignInCode(engine.backend, { ...sign, code: 'bad' })).toEqual({
        status: 'failed',
        message: 'error'
      })
      expect(await submitSignInCode(engine.backend, { ...sign, code: ' good ' })).toEqual({
        status: 'approved'
      })
    })

    it('should sign out of an account and say so when there was nothing to sign out', async () => {
      engine.accounts[0].status = { logged_in: true }

      await disconnectAccount(engine.backend, 'openai-codex')
      expect(engine.accounts[0].status.logged_in).toBe(false)

      await expect(disconnectAccount(engine.backend, 'openai-codex')).rejects.toMatchObject({
        key: 'providers.errorNotSignedOut'
      })
    })
  })
})
