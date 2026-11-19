import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { useLanguage } from '@shared/lib/i18n'
import { filterSkills, loadSkills, setSkillEnabled } from '@features/bots/memory'
import type { MemoryBackend, Skill } from '@features/bots/memory'
import { TryAgain } from '@features/bots/ProblemMessage'
import type { Bot } from '@features/bots/types'
import { ownOrFailure, problemOf, problemText } from '@shared/lib/problem'
import type { Problem } from '@shared/lib/problem'
import { useLoad } from '@shared/hooks/useLoad'
import { useOnChange } from '@shared/hooks/useOnChange'
import { Loading, Skeleton } from '@shared/ui/skeleton'
import { Switch } from '@shared/ui/switch'
import { announce, type Counted } from './memoryViews'
import { SkillDialog } from './SkillDialog'

export function SkillsSection({
  bot,
  backend,
  query,
  counted
}: {
  bot: Bot
  backend: MemoryBackend
  query: string
  counted: Counted
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [skills, setSkills] = useState<Skill[] | null>(null)
  const [problem, setProblem] = useState<Problem | null>(null)
  const [opened, setOpened] = useState<Skill | null>(null)
  // Skills whose change the engine has not answered yet.
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set())

  const readAgain = useLoad(
    useCallback(() => loadSkills(backend, bot.name), [backend, bot.name]),
    {
      loaded: (loaded) => {
        setSkills(loaded)
        setProblem(null)
      },
      failed: (error) => setProblem(problemOf(error))
    }
  )

  // The switch moves at once and moves back if the engine refuses; it waits for the engine's
  // answer before it moves again, so two changes never cross.
  async function toggle(skill: Skill, enabled: boolean): Promise<void> {
    const set = (value: boolean): void =>
      setSkills(
        (now) =>
          now?.map((item) => (item.name === skill.name ? { ...item, enabled: value } : item)) ??
          null
      )
    set(enabled)
    setPending((now) => new Set(now).add(skill.name))
    try {
      await setSkillEnabled(backend, bot.name, { name: skill.name, enabled })
    } catch (error) {
      set(skill.enabled)
      toast.error(problemText(t, ownOrFailure('skills.errorToggle', error)), {
        duration: Infinity
      })
    } finally {
      setPending((now) => {
        const next = new Set(now)
        next.delete(skill.name)
        return next
      })
    }
  }

  const shown = skills && filterSkills(skills, query)
  useOnChange(skills?.length, (total) => {
    if (total !== undefined) counted('skills', total)
  })

  return (
    <div className="space-y-2">
      <p role="status" className="sr-only">
        {announce(t, query.trim() ? shown?.length : undefined, 'skills.noMatch')}
      </p>
      {problem ? (
        <TryAgain
          problem={problem}
          onRetry={() => {
            setProblem(null)
            readAgain()
          }}
        />
      ) : !shown ? (
        <Loading label={t('skills.loading')} className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </Loading>
      ) : skills.length === 0 ? (
        <p className="rounded-xl bg-secondary p-4 text-base">{t('skills.empty')}</p>
      ) : (
        <>
          {shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('skills.noMatch')}</p>
          ) : (
            <ul className="space-y-1.5">
              {shown.map((skill) => (
                <li
                  key={skill.name}
                  className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2"
                >
                  {/* The row opens the skill to read, edit or delete it. */}
                  <button
                    onClick={() => setOpened(skill)}
                    className="-my-1 -ms-2 min-w-0 flex-1 rounded-lg px-2 py-1 text-start transition-colors hover:bg-foreground/10"
                  >
                    <span className="block text-sm font-medium wrap-break-word">{skill.name}</span>
                    {skill.description && (
                      <span className="block text-sm text-muted-foreground">
                        {skill.description}
                      </span>
                    )}
                  </button>
                  <Switch
                    checked={skill.enabled}
                    disabled={pending.has(skill.name)}
                    aria-label={t('skills.use').replace('{name}', skill.name)}
                    onCheckedChange={(enabled) => void toggle(skill, enabled)}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {opened && (
        <SkillDialog
          bot={bot.name}
          backend={backend}
          skill={opened}
          onClose={() => setOpened(null)}
          onChanged={() => {
            setOpened(null)
            // The list behind the dialog is read again, as after Try again.
            readAgain()
          }}
        />
      )}
    </div>
  )
}
