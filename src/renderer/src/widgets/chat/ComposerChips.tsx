import { DropdownMenu } from 'radix-ui'
import { ChevronDown } from 'lucide-react'
import { useLanguage, type TranslationKey } from '@shared/lib/i18n'
import type { ChatActions } from '@features/chat/chat'
import type { ChatState } from '@features/chat/store'
import { ModelPicker } from '@shared/ui/ModelPicker'
import { CheckItem, menuContentClass } from '@shared/ui/menu'

const REASONING_LEVELS: Array<[string, TranslationKey]> = [
  ['low', 'chat.reasoningLow'],
  ['medium', 'chat.reasoningMedium'],
  ['high', 'chat.reasoningHigh']
]

interface ChipMenuProps {
  chat: ChatState
  actions: ChatActions
  // The composer's text field: closing a chip's menu puts focus back there, not on the chip.
  returnFocusTo: React.RefObject<HTMLTextAreaElement | null>
}

export function ChatChips(props: ChipMenuProps): React.JSX.Element {
  return (
    <>
      <ModelMenu {...props} />
      <ReasoningMenu {...props} />
    </>
  )
}

function ModelMenu({ chat, actions, returnFocusTo }: ChipMenuProps): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const selected =
    chat.info.model && chat.info.provider
      ? { model: chat.info.model, provider: chat.info.provider }
      : null
  return (
    <ModelPicker
      load={() => actions.models(chat.profile)}
      selected={selected}
      onSelect={(pick) => void actions.setModel(chat.profile, pick)}
      labels={{ loading: t('chat.modelsLoading'), failed: t('chat.modelsFailed') }}
      returnFocusTo={returnFocusTo}
    >
      {/* A chat with no session yet shows the bot's own model; a pick starts the session. */}
      <Chip label={t('chat.model')} value={chat.info.model ?? t('chat.modelDefault')} />
    </ModelPicker>
  )
}

function ReasoningMenu({ chat, actions, returnFocusTo }: ChipMenuProps): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const current = REASONING_LEVELS.find(([level]) => level === chat.info.reasoning)
  return (
    <DropdownMenu.Root>
      <Chip label={t('chat.reasoning')} value={current ? t(current[1]) : t('chat.reasoning')} />
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={4}
          className={menuContentClass}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            returnFocusTo.current?.focus()
          }}
        >
          {REASONING_LEVELS.map(([level, label]) => (
            <CheckItem
              key={level}
              label={t(label)}
              selected={chat.info.reasoning === level}
              onSelect={() => void actions.setReasoning(chat.profile, level)}
            />
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

/** A composer chip that opens a menu; the bot chat's model and reasoning, a room's model. */
export function Chip({
  label,
  value,
  disabled = false
}: {
  label: string
  value: string
  disabled?: boolean
}): React.JSX.Element {
  return (
    <DropdownMenu.Trigger
      disabled={disabled}
      aria-label={`${label}: ${value}`}
      className="flex h-9 max-w-48 items-center gap-1 rounded-full px-3 text-sm hover:bg-foreground/10 disabled:opacity-50 disabled:hover:bg-transparent"
    >
      <span className="truncate">{value}</span>
      <ChevronDown size={14} className="shrink-0" />
    </DropdownMenu.Trigger>
  )
}
