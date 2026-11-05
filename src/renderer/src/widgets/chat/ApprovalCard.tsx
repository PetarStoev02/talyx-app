import { useId } from 'react'
import { useLanguage } from '@app/providers/useLanguage'
import type { TranslationKey } from '@shared/lib/i18n'
import type { ApprovalChoice, ChatPrompt } from '@features/chat/types'
import { Button } from '@shared/ui/button'

type Approval = Extract<ChatPrompt, { kind: 'approval' }>

const CHOICES: Array<[ApprovalChoice, TranslationKey]> = [
  ['deny', 'chat.approvalDeny'],
  ['once', 'chat.approvalOnce'],
  ['session', 'chat.approvalSession'],
  ['always', 'chat.approvalAlways']
]

/** The engine's four answers, in its order; only the ones this request offers. */
export function ApprovalCard({
  prompt,
  botName,
  onAnswer
}: {
  prompt: Approval
  botName: string
  onAnswer: (choice: ApprovalChoice) => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const titleId = useId()
  const offered = CHOICES.filter(
    ([choice]) => !prompt.choices.length || prompt.choices.includes(choice)
  )
  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-secondary p-5" aria-labelledby={titleId}>
      <p id={titleId} className="text-base font-medium">
        {t('chat.approvalTitle').replace('{name}', botName)}
      </p>
      <pre className="overflow-x-auto rounded-2xl bg-background p-3 font-mono text-sm whitespace-pre-wrap">
        {prompt.command}
      </pre>
      {prompt.description && <p className="text-base">{prompt.description}</p>}
      <div className="flex flex-wrap gap-2">
        {offered.map(([choice, label]) => (
          <Button
            key={choice}
            type="button"
            variant={choice === 'once' ? 'default' : 'secondary'}
            onClick={() => onAnswer(choice)}
          >
            {t(label)}
          </Button>
        ))}
      </div>
    </section>
  )
}
