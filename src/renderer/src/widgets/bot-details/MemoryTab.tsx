import { useCallback, useState } from 'react'
import { Tabs } from 'radix-ui'
import { useLanguage, type TranslationKey } from '@shared/lib/i18n'
import type { MemoryBackend } from '@features/bots/memory'
import type { Bot } from '@features/bots/types'
import { Input } from '@shared/ui/input'
import { MemoriesSection } from './MemoriesSection'
import type { Counted, View } from './memoryViews'
import { SkillsSection } from './SkillsSection'

const VIEWS: Record<View, { label: TranslationKey; search: TranslationKey }> = {
  memories: { label: 'memory.title', search: 'memory.search' },
  skills: { label: 'skills.title', search: 'skills.search' }
}

/**
 * What the bot remembers and which skills it has, one list at a time under a search that stays
 * in reach while the list scrolls. Each change goes to the engine at once; the panel's Save is
 * not involved.
 */
export function MemoryTab({
  bot,
  backend
}: {
  bot: Bot
  backend: MemoryBackend
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [view, setView] = useState<View>('memories')
  // Each list keeps its own search.
  const [queries, setQueries] = useState<Record<View, string>>({ memories: '', skills: '' })
  const [counts, setCounts] = useState<Record<View, number | null>>({
    memories: null,
    skills: null
  })
  const counted = useCallback<Counted>(
    (which, count) => setCounts((now) => (now[which] === count ? now : { ...now, [which]: count })),
    []
  )
  const searchLabel = t(VIEWS[view].search)

  return (
    <Tabs.Root value={view} onValueChange={(value) => setView(value as View)}>
      {/* Stays at the top of the panel while the list under it scrolls. */}
      <div className="tone-step sticky -top-4 z-10 -mt-4 space-y-2 pt-4 pb-3">
        <Tabs.List aria-label={t('memory.views')} className="flex gap-1">
          {(Object.keys(VIEWS) as View[]).map((id) => (
            <Tabs.Trigger
              key={id}
              value={id}
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:bg-foreground/10 data-[state=active]:text-foreground"
            >
              {t(VIEWS[id].label)}
              {/* A space, so the name reads "Skills 58", not "Skills58". */}
              {counts[id] !== null && <span className="tabular-nums">{` ${counts[id]}`}</span>}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Input
          type="search"
          value={queries[view]}
          aria-label={searchLabel}
          placeholder={searchLabel}
          onChange={(event) => setQueries((now) => ({ ...now, [view]: event.target.value }))}
        />
      </div>
      {/* Both stay mounted, so switching keeps each list and its place. */}
      <Tabs.Content value="memories" forceMount className="data-[state=inactive]:hidden">
        <MemoriesSection bot={bot} backend={backend} query={queries.memories} counted={counted} />
      </Tabs.Content>
      <Tabs.Content value="skills" forceMount className="data-[state=inactive]:hidden">
        <SkillsSection bot={bot} backend={backend} query={queries.skills} counted={counted} />
      </Tabs.Content>
    </Tabs.Root>
  )
}
