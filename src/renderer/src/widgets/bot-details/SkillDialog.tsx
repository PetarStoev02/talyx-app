import { useEffect, useState } from 'react'
import { useLanguage } from '@app/providers/useLanguage'
import { deleteSkill, editSkill, loadSkillText } from '@features/bots/memory'
import type { MemoryBackend, Skill } from '@features/bots/memory'
import { ProblemMessage } from '@features/bots/ProblemMessage'
import { ownOrFailure } from '@shared/lib/problem'
import type { Problem } from '@shared/lib/problem'
import { Button } from '@shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@shared/ui/dialog'
import { Textarea } from '@shared/ui/input'
import { Loading, Skeleton } from '@shared/ui/skeleton'

/**
 * One skill's instructions file, to read and edit, and Delete for a skill the bot made. Mounted
 * only while open, so it reads the file fresh each time.
 */
export function SkillDialog({
  bot,
  backend,
  skill,
  onClose,
  onChanged
}: {
  bot: string
  backend: MemoryBackend
  skill: Skill
  onClose: () => void
  /** After a save or a delete, so the skills are read again. */
  onChanged: () => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [opening, setOpening] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [problem, setProblem] = useState<Problem | null>(null)

  useEffect(() => {
    let current = true
    loadSkillText(backend, bot, skill.name).then(
      (loaded) => {
        if (!current) return
        setOpening(loaded)
        setText(loaded)
      },
      (error: unknown) => current && setProblem(ownOrFailure('skills.errorLoad', error))
    )
    return () => {
      current = false
    }
  }, [backend, bot, skill.name])

  async function run(change: () => Promise<void>, failed: Problem['key']): Promise<void> {
    setBusy(true)
    setProblem(null)
    try {
      await change()
      onChanged()
    } catch (error) {
      setProblem(ownOrFailure(failed, error))
    } finally {
      setBusy(false)
    }
  }

  const save = (): Promise<void> =>
    run(() => editSkill(backend, bot, { name: skill.name, text }), 'skills.errorSave')
  const remove = (): Promise<void> =>
    run(() => deleteSkill(backend, bot, skill), 'skills.errorDelete')

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogTitle className="wrap-break-word">
          {confirming ? t('skills.deleteTitle').replace('{name}', skill.name) : skill.name}
        </DialogTitle>
        <DialogDescription>
          {t(confirming ? 'skills.deleteWarning' : 'skills.editHint')}
        </DialogDescription>
        {confirming ? null : opening === null && !problem ? (
          <Loading label={t('skills.loadingText')}>
            <Skeleton className="h-64 w-full" />
          </Loading>
        ) : (
          opening !== null && (
            <label className="block text-base">
              {t('skills.instructions')}
              <Textarea
                value={text}
                rows={14}
                spellCheck={false}
                onChange={(event) => setText(event.target.value)}
                className="font-mono text-sm"
              />
            </label>
          )
        )}
        {problem && <ProblemMessage problem={problem} />}
        {!confirming && !skill.removable && opening !== null && (
          <p className="text-sm text-muted-foreground">{t('skills.builtIn')}</p>
        )}
        {/* Primary first, as in every dialog. */}
        <div className="flex flex-wrap gap-2">
          {confirming ? (
            <>
              <Button variant="destructive" disabled={busy} onClick={() => void remove()}>
                {t('skills.delete')}
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                {t('roster.cancel')}
              </Button>
            </>
          ) : (
            <>
              <Button
                disabled={busy || opening === null || text === opening}
                onClick={() => void save()}
              >
                {busy ? t('skills.saving') : t('skills.save')}
              </Button>
              <Button variant="ghost" onClick={onClose}>
                {t('roster.cancel')}
              </Button>
              {skill.removable && (
                <Button
                  variant="ghost"
                  className="ms-auto text-destructive-text"
                  onClick={() => {
                    setProblem(null)
                    setConfirming(true)
                  }}
                >
                  {t('skills.delete')}
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
