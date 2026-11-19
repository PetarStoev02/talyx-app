import { useCallback, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useLanguage, type TranslationKey } from '@shared/lib/i18n'
import { deleteMemory, editMemory, filterMemories, loadMemories } from '@features/bots/memory'
import type { Memory, MemoryBackend, MemoryList } from '@features/bots/memory'
import { ProblemMessage, TryAgain } from '@features/bots/ProblemMessage'
import type { Bot } from '@features/bots/types'
import { AppError, ownOrFailure, problemOf, problemText } from '@shared/lib/problem'
import type { Problem } from '@shared/lib/problem'
import { useLoad } from '@shared/hooks/useLoad'
import { useOnChange } from '@shared/hooks/useOnChange'
import { Button } from '@shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@shared/ui/dialog'
import { IconButton } from '@shared/ui/IconButton'
import { Textarea } from '@shared/ui/input'
import { Loading, Skeleton } from '@shared/ui/skeleton'
import { announce, type Counted } from './memoryViews'

// How much of a memory its row's button names carry.
const OPENING_LENGTH = 40

export function MemoriesSection({
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

  useLoad(
    useCallback(() => loadMemories(backend, bot.name), [backend, bot.name]),
    {
      loaded: (loaded) => {
        setList(loaded)
        setProblem(null)
      },
      failed: (error) => setProblem(problemOf(error))
    }
  )

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
  useOnChange(list?.memories.length, (total) => {
    if (total !== undefined) counted('memories', total)
  })

  return (
    <div className="space-y-2">
      {list?.otherStore && (
        <p className="text-sm text-muted-foreground">
          {t('memory.otherStore').replace('{store}', list.otherStore)}
        </p>
      )}
      <p role="status" className="sr-only">
        {announce(t, query.trim() ? shown?.length : undefined, 'memory.noMatch')}
      </p>
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
  // A split always has a first piece, empty for empty text.
  const [line = ''] = text.split('\n', 1)
  return line.length > OPENING_LENGTH ? `${line.slice(0, OPENING_LENGTH).trimEnd()}…` : line
}
