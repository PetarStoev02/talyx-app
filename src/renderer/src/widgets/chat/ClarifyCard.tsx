import { useId, useState } from 'react'
import { useLanguage } from '@app/providers/useLanguage'
import { cn } from '@shared/lib/utils'
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
          <button
            key={choice}
            type="button"
            aria-pressed={chosen(choice)}
            onClick={() => choose(choice)}
            className={cn(
              'rounded-full px-4 py-2 text-base',
              chosen(choice)
                ? 'bg-primary text-primary-foreground'
                : 'bg-background hover:bg-accent'
            )}
          >
            {choice}
          </button>
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
                  'size-1.5 rounded-full',
                  index === page ? 'bg-foreground' : 'bg-muted-foreground/40'
                )}
              />
            ))}
          </span>
        )}
        <span className="ml-auto flex items-center gap-4">
          {page > 0 && (
            <button type="button" className="text-base underline" onClick={() => setPage(page - 1)}>
              {t('chat.clarifyBack')}
            </button>
          )}
          <button
            type="button"
            disabled={sending || empty}
            onClick={() => void next()}
            className="rounded-full bg-primary px-5 py-2 text-base text-primary-foreground disabled:opacity-50"
          >
            {last ? t('chat.clarifySend') : t('chat.clarifyNext')}
          </button>
        </span>
      </div>
    </section>
  )
}
