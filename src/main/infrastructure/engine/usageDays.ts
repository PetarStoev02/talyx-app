import { z } from 'zod'
import pluginInit from '../../../../resources/engine-plugin/talyx-usage/__init__.py?raw'
import pluginManifest from '../../../../resources/engine-plugin/talyx-usage/plugin.yaml?raw'
import type { BotDays, UsageDays } from '@contract/engine'
import { enginePlugin, type EnginePluginDeps } from './enginePlugin'

/** The engine plugin's name, as its manifest and its CLI command spell it. */
export const USAGE_PLUGIN = 'talyx-usage'

export const USAGE_PLUGIN_FILES: Record<string, string> = {
  '__init__.py': pluginInit,
  'plugin.yaml': pluginManifest
}

// What the plugin answers per bot: its rows, or why its store could not be read.
const BotDaysSchema: z.ZodType<BotDays> = z.union([
  z.object({
    rows: z.array(
      z.object({
        day: z.string(),
        model: z.string(),
        provider: z.string().nullable(),
        base_url: z.string(),
        input_tokens: z.number().nullable(),
        output_tokens: z.number().nullable(),
        api_calls: z.number().nullable()
      })
    )
  }),
  z.object({ error: z.string() })
])
const BotsSchema = z.record(z.string(), BotDaysSchema)

/**
 * Each bot's tokens per local day and billing provider, read from its own store by Talyx's engine
 * plugin: the engine's REST has days, and providers, but not the two together.
 */
export function usageDays(deps: EnginePluginDeps): {
  read: (profiles: string[], days: number) => Promise<UsageDays>
} {
  const plugin = enginePlugin(deps, { name: USAGE_PLUGIN, files: USAGE_PLUGIN_FILES })
  return {
    async read(profiles, days) {
      const { code, printed, answer } = await plugin.run((home) => [
        'days',
        '--home',
        home,
        '--days',
        String(days),
        ...profiles.flatMap((profile) => ['--profile', profile])
      ])
      if (code !== 0 || !answer?.ok)
        throw new Error(answer?.error ?? `Usage per day could not be read: ${printed}`)
      return BotsSchema.parse(answer.bots)
    }
  }
}
