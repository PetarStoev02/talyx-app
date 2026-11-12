import { useId, useState } from 'react'
import { useLanguage } from '@app/providers/useLanguage'
import { cn } from '@shared/lib/utils'
import { Button } from '@shared/ui/button'
import type { ChatPrompt } from '@features/chat/types'

type Clarify = Extract<ChatPrompt, { kind: 'clarify' }>
type Answers = Record<string, string | string[]>

/** One question per page, its choices as pills; the last page sends every answer. */
export function ClarifyCard({
  prompt,
  onAnswer
}: {
  prompt: Clarify
  onAnswer: (answers: Answers) => Promise<void>
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [page, setPage] = useState(0)
  const [answers, setAnswers] = useState<Answers>(prompt.answers)
  const [sending, setSending] = useState(false)
  const titleId = useId()
  const question = prompt.questions[page]
  if (!question) return <></>
  const last = page === prompt.questions.length - 1
  const picked = answers[question.qid]
  const empty =
    picked === undefined || (Array.isArray(picked) ? !picked.length : !String(picked).trim())
  const chosen = (choice: string): boolean =>
    Array.isArray(picked) ? picked.includes(choice) : picked === choice

  function choose(choice: string): void {
    setAnswers((current) => {
      if (!question.multiSelect) return { ...current, [question.qid]: choice }
      const list = Array.isArray(current[question.qid]) ? (current[question.qid] as string[]) : []
      return {
        ...current,
        [question.qid]: list.includes(choice)
          ? list.filter((item) => item !== choice)
          : [...list, choice]
      }
    })
  }

  async function next(): Promise<void> {
    if (!last) return setPage(page + 1)
    setSending(true)
    try {
      await onAnswer(answers)
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-secondary p-5" aria-labelledby={titleId}>
      <p id={titleId} className="text-base font-medium">
        {question.question}
      </p>
      {/* An open question has no choices: the answer is typed. */}
      {!question.choices.length && (
        <input
          aria-labelledby={titleId}
          value={typeof picked === 'string' ? picked : ''}
          onChange={(event) =>
            setAnswers((current) => ({ ...current, [question.qid]: event.target.value }))
          }
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !empty && !sending) void next()
          }}
          className="rounded-full bg-background px-4 py-2 text-base"
        />
      )}
      <div className="flex flex-wrap gap-2">
        {question.choices.map((choice) => (
          <Button
            key={choice}
            type="button"
            variant={chosen(choice) ? 'default' : 'secondary'}
            aria-pressed={chosen(choice)}
            onClick={() => choose(choice)}
            className="h-auto min-h-9 max-w-full shrink text-left whitespace-normal wrap-anywhere"
          >
            {choice}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-4">
        {prompt.questions.length > 1 && (
          <span
            role="img"
            className="flex gap-1.5"
            aria-label={t('chat.clarifyPage')
              .replace('{page}', String(page + 1))
              .replace('{pages}', String(prompt.questions.length))}
          >
            {prompt.questions.map((item, index) => (
              <span
                key={item.qid}
                className={cn(
                  'h-2 rounded-full',
                  index === page ? 'w-4 bg-foreground' : 'w-2 bg-muted-foreground'
                )}
              />
            ))}
          </span>
        )}
        <span className="ml-auto flex items-center gap-2">
          {page > 0 && (
            <Button type="button" variant="ghost" onClick={() => setPage(page - 1)}>
              {t('chat.clarifyBack')}
            </Button>
          )}
          <Button type="button" disabled={sending || empty} onClick={() => void next()}>
            {last ? t('chat.clarifySend') : t('chat.clarifyNext')}
          </Button>
        </span>
      </div>
    </section>
  )
}
