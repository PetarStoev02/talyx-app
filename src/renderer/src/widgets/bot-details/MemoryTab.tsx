import { useCallback, useEffect, useState } from 'react'
import { Tabs } from 'radix-ui'
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useLanguage } from '@app/providers/useLanguage'
import {
  deleteMemory,
  editMemory,
  filterMemories,
  filterSkills,
  loadMemories,
  loadSkills,
  setSkillEnabled
} from '@features/bots/memory'
import type { Memory, MemoryBackend, MemoryList, Skill } from '@features/bots/memory'
import { ProblemMessage, TryAgain } from '@features/bots/ProblemMessage'
import type { Bot } from '@features/bots/types'
import { AppError, ownOrFailure, problemOf, problemText } from '@shared/lib/problem'
import type { Problem } from '@shared/lib/problem'
import type { TranslationKey } from '@shared/lib/i18n'
import { Button } from '@shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@shared/ui/dialog'
import { IconButton } from '@shared/ui/IconButton'
import { Input, Textarea } from '@shared/ui/input'
import { Loading, Skeleton } from '@shared/ui/skeleton'
import { Switch } from '@shared/ui/switch'
import { SkillDialog } from './SkillDialog'

// How much of a memory its row's button names carry.
const OPENING_LENGTH = 40

type View = 'memories' | 'skills'
const VIEWS: Record<View, { label: TranslationKey; search: TranslationKey }> = {
  memories: { label: 'memory.title', search: 'memory.search' },
  skills: { label: 'skills.title', search: 'skills.search' }
}

/** What a view tells the tab: how many it lists, once loaded. */
type Counted = (view: View, count: number) => void

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

function MemoriesSection({
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
  const [list, setList] = useState<MemoryList | null>(null)
  const [problem, setProblem] = useState<Problem | null>(null)
  const [editing, setEditing] = useState<Memory | null>(null)
  const [deleting, setDeleting] = useState<Memory | null>(null)

  const load = useCallback(
    (): Promise<void> =>
      loadMemories(backend, bot.name).then(
        (loaded) => {
          setList(loaded)
          setProblem(null)
        },
        (error: unknown) => setProblem(problemOf(error))
      ),
    [backend, bot.name]
  )

  useEffect(() => {
    let current = true
    loadMemories(backend, bot.name).then(
      (loaded) => {
        if (!current) return
        setList(loaded)
        setProblem(null)
      },
      (error: unknown) => current && setProblem(problemOf(error))
    )
    return () => {
      current = false
    }
  }, [backend, bot.name])

  // After a failure the list is read again too. When the bot changed the memory meanwhile, the
  // dialog closes and the fresh list shows it; any other failure keeps the dialog and its text.
  async function change(run: () => Promise<MemoryList>, failed: TranslationKey): Promise<void> {
    try {
      setList(await run())
    } catch (error) {
      const problem = ownOrFailure(failed, error)
      // A refusal before anything was sent leaves the list as it is.
      if (problem.key === 'memory.errorEmpty') throw new AppError(problem.key)
      await load()
      if (problem.key !== 'memory.errorChanged') throw new AppError(problem.key, problem.detail)
      toast.error(problemText(t, problem), { duration: Infinity })
    }
  }

  const shown = list && filterMemories(list.memories, query)
  const total = list?.memories.length
  useEffect(() => {
    if (total !== undefined) counted('memories', total)
  }, [counted, total])

  return (
    <div className="space-y-2">
      {list?.otherStore && (
        <p className="text-sm text-muted-foreground">
          {t('memory.otherStore').replace('{store}', list.otherStore)}
        </p>
      )}
      {problem ? (
        <TryAgain problem={problem} onRetry={() => void load()} />
      ) : !list ? (
        <Loading label={t('memory.loading')} className="space-y-2">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </Loading>
      ) : list.memories.length === 0 ? (
        <p className="rounded-xl bg-secondary p-4 text-base">{t('memory.empty')}</p>
      ) : shown?.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('memory.noMatch')}</p>
      ) : (
        <ul className="space-y-1.5">
          {shown?.map((memory) => (
            <li
              key={memory.id}
              className="flex items-start gap-1 rounded-xl bg-secondary py-2 ps-3 pe-1"
            >
              <div className="min-w-0 flex-1">
                {memory.about === 'user' && (
                  <span className="mb-1 inline-block rounded-full bg-foreground/10 px-2 text-xs">
                    {t('memory.aboutUser')}
                  </span>
                )}
                <p className="text-sm whitespace-pre-wrap wrap-break-word">{memory.text}</p>
              </div>
              <IconButton
                label={t('memory.editOne').replace('{text}', opening(memory.text))}
                className="size-8"
                onClick={() => setEditing(memory)}
              >
                <Pencil />
              </IconButton>
              <IconButton
                label={t('memory.deleteOne').replace('{text}', opening(memory.text))}
                className="size-8"
                onClick={() => setDeleting(memory)}
              >
                <Trash2 />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <EditMemoryDialog
          memory={editing}
          onClose={() => setEditing(null)}
          onSave={async (text) => {
            await change(
              () => editMemory(backend, bot.name, { id: editing.id, text }),
              'memory.errorSave'
            )
            setEditing(null)
          }}
        />
      )}
      {deleting && (
        <DeleteMemoryDialog
          memory={deleting}
          onClose={() => setDeleting(null)}
          onDelete={async () => {
            await change(() => deleteMemory(backend, bot.name, deleting.id), 'memory.errorDelete')
            setDeleting(null)
          }}
        />
      )}
    </div>
  )
}

function SkillsSection({
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
  const [attempt, setAttempt] = useState(0)
  const [opened, setOpened] = useState<Skill | null>(null)
  // Skills whose change the engine has not answered yet.
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    let current = true
    loadSkills(backend, bot.name).then(
      (loaded) => {
        if (!current) return
        setSkills(loaded)
        setProblem(null)
      },
      (error: unknown) => current && setProblem(problemOf(error))
    )
    return () => {
      current = false
    }
  }, [backend, bot.name, attempt])

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
  const total = skills?.length
  useEffect(() => {
    if (total !== undefined) counted('skills', total)
  }, [counted, total])

  return (
    <div className="space-y-2">
      {problem ? (
        <TryAgain
          problem={problem}
          onRetry={() => {
            setProblem(null)
            setAttempt((n) => n + 1)
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
                    aria-label={t('skills.open').replace('{name}', skill.name)}
                    onClick={() => setOpened(skill)}
                    className="min-w-0 flex-1 rounded-lg text-start hover:opacity-80"
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
            setAttempt((n) => n + 1)
          }}
        />
      )}
    </div>
  )
}

// Mounted only while open, so the field starts from the memory each time.
function EditMemoryDialog({
  memory,
  onClose,
  onSave
}: {
  memory: Memory
  onClose: () => void
  onSave: (text: string) => Promise<void>
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [text, setText] = useState(memory.text)
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<Problem | null>(null)

  async function save(): Promise<void> {
    setSaving(true)
    setProblem(null)
    try {
      await onSave(text)
    } catch (error) {
      setProblem(problemOf(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogTitle>{t('memory.edit')}</DialogTitle>
        <DialogDescription>{t('memory.editHint')}</DialogDescription>
        <Textarea
          value={text}
          rows={6}
          aria-label={t('memory.edit')}
          onChange={(event) => setText(event.target.value)}
        />
        {problem && <ProblemMessage problem={problem} />}
        <div className="flex gap-2">
          <Button disabled={saving || text.trim() === memory.text} onClick={() => void save()}>
            {saving ? t('memory.saving') : t('memory.save')}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t('roster.cancel')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Names the memory it deletes: a memory has no title, only its text.
function DeleteMemoryDialog({
  memory,
  onClose,
  onDelete
}: {
  memory: Memory
  onClose: () => void
  onDelete: () => Promise<void>
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [problem, setProblem] = useState<Problem | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function remove(): Promise<void> {
    setDeleting(true)
    setProblem(null)
    try {
      await onDelete()
    } catch (error) {
      setProblem(problemOf(error))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogTitle>{t('memory.deleteTitle')}</DialogTitle>
        <DialogDescription className="space-y-2">
          <span className="block whitespace-pre-wrap wrap-break-word text-foreground">
            {t('memory.quoted').replace('{text}', memory.text)}
          </span>
          <span className="block">{t('memory.deleteWarning')}</span>
        </DialogDescription>
        {problem && <ProblemMessage problem={problem} />}
        <div className="flex gap-2">
          <Button variant="destructive" disabled={deleting} onClick={() => void remove()}>
            {t('memory.deleteConfirm')}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t('roster.cancel')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// The start of a memory, enough to tell its row's buttons apart.
function opening(text: string): string {
  const line = text.split('\n', 1)[0]
  return line.length > OPENING_LENGTH ? `${line.slice(0, OPENING_LENGTH).trimEnd()}…` : line
}
