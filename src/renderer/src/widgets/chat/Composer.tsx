import { useRef, useState } from 'react'
import { DropdownMenu } from 'radix-ui'
import { ArrowUp, ChevronDown, LoaderCircle, Mic, Plus, Square, X } from 'lucide-react'
import { toast } from 'sonner'
import { useLanguage } from '@app/providers/useLanguage'
import type { ChatActions, ChatImage } from '@features/chat/chat'
import type { ChatState } from '@features/chat/store'
import { dataUrlOf, useDictation } from '@features/chat/useDictation'
import { cn } from '@shared/lib/utils'
import { MenuItem, ModelPicker } from '@shared/ui/ModelPicker'
import type { TranslationKey } from '@shared/lib/i18n'

const MAX_ROWS = 8
const REASONING_LEVELS: Array<[string, TranslationKey]> = [
  ['low', 'chat.reasoningLow'],
  ['medium', 'chat.reasoningMedium'],
  ['high', 'chat.reasoningHigh']
]

type Attached = ChatImage & { name: string }

export function Composer({
  chat,
  title,
  actions
}: {
  chat: ChatState
  title: string
  actions: ChatActions
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [text, setText] = useState('')
  const [images, setImages] = useState<Attached[]>([])
  const [sending, setSending] = useState(false)
  const picker = useRef<HTMLInputElement>(null)
  // Until the engine starts the turn, a send in flight counts as running: no second send.
  const running = sending || chat.transcript?.running === true
  const { profile } = chat
  const dictation = useDictation(
    (audio) => actions.transcribe(profile, audio),
    (words) => setText((current) => (current.trim() ? `${current}\n${words}` : words)),
    (error) => toast.error(error instanceof Error ? error.message : String(error))
  )

  async function send(): Promise<void> {
    if (running || (!text.trim() && !images.length)) return
    const draft = { text, images: images.map(({ path, mime }) => ({ path, mime })) }
    const attached = images
    setText('')
    setImages([])
    setSending(true)
    const sent = await actions.send(profile, draft).finally(() => setSending(false))
    if (sent) return
    // A failed send gives the draft back, unless something new was typed meanwhile.
    setText((current) => current || text)
    setImages((current) => (current.length ? current : attached))
  }

  async function attach(files: Iterable<File>): Promise<void> {
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue
      try {
        const image = await actions.uploadImage(profile, {
          dataUrl: await dataUrlOf(file),
          name: file.name
        })
        setImages((current) => [...current, { ...image, name: file.name }])
      } catch {
        toast.error(t('chat.imageFailed').replace('{name}', file.name))
      }
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    void send()
  }

  return (
    <form
      className="mx-auto w-full max-w-3xl px-6 pb-6"
      onSubmit={(event) => {
        event.preventDefault()
        void send()
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        void attach(event.dataTransfer.files)
      }}
    >
      <div className="chat-composer flex flex-col gap-2 rounded-3xl bg-secondary p-3">
        {images.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {images.map((image) => (
              <li
                key={image.path}
                className="flex items-center gap-1 rounded-full bg-background py-1 pr-1 pl-3 text-sm"
              >
                {image.name}
                <button
                  type="button"
                  aria-label={t('chat.removeImage').replace('{name}', image.name)}
                  onClick={() => setImages((current) => current.filter((item) => item !== image))}
                  className="rounded-full p-1 hover:bg-accent"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <textarea
          value={text}
          rows={1}
          aria-label={t('chat.placeholder').replace('{name}', title)}
          placeholder={t('chat.placeholder').replace('{name}', title)}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          onPaste={(event) => {
            if (event.clipboardData.files.length) {
              event.preventDefault()
              void attach(event.clipboardData.files)
            }
          }}
          className="field-sizing-content resize-none bg-transparent px-2 py-1 text-base outline-none"
          style={{ maxHeight: `calc(${MAX_ROWS}lh + 0.5rem)` }}
        />
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={t('chat.addImage')}
            onClick={() => picker.current?.click()}
            className="rounded-full p-2 hover:bg-accent"
          >
            <Plus size={18} />
          </button>
          <input
            ref={picker}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => {
              void attach(event.target.files ?? [])
              event.target.value = ''
            }}
          />
          <ModelMenu chat={chat} actions={actions} />
          <ReasoningMenu chat={chat} actions={actions} />
          <span className="ml-auto" />
          <button
            type="button"
            aria-label={
              dictation.state === 'recording'
                ? t('chat.dictating')
                : dictation.state === 'transcribing'
                  ? t('chat.transcribing')
                  : t('chat.dictate')
            }
            aria-pressed={dictation.state === 'recording'}
            disabled={dictation.state === 'transcribing' || dictation.state === 'starting'}
            onClick={dictation.toggle}
            className={cn(
              'rounded-full p-2 hover:bg-accent',
              dictation.state === 'recording' &&
                'bg-primary text-primary-foreground hover:bg-primary'
            )}
          >
            {dictation.state === 'transcribing' ? (
              <LoaderCircle size={18} className="animate-spin" />
            ) : (
              <Mic size={18} />
            )}
          </button>
          {running ? (
            <button
              type="button"
              aria-label={t('chat.stop')}
              onClick={() => void actions.interrupt(profile)}
              className="rounded-full bg-primary p-2 text-primary-foreground"
            >
              <Square size={16} fill="currentColor" />
            </button>
          ) : (
            <button
              type="submit"
              aria-label={t('chat.send')}
              disabled={!text.trim() && !images.length}
              className="rounded-full bg-primary p-2 text-primary-foreground disabled:opacity-50"
            >
              <ArrowUp size={16} />
            </button>
          )}
        </div>
      </div>
    </form>
  )
}

function ModelMenu({
  chat,
  actions
}: {
  chat: ChatState
  actions: ChatActions
}): React.JSX.Element {
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
      loadingLabel={t('chat.modelsLoading')}
    >
      <Chip chat={chat} label={t('chat.model')} value={chat.info.model ?? t('chat.modelDefault')} />
    </ModelPicker>
  )
}

function ReasoningMenu({
  chat,
  actions
}: {
  chat: ChatState
  actions: ChatActions
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const current = REASONING_LEVELS.find(([level]) => level === chat.info.reasoning)
  return (
    <DropdownMenu.Root>
      <Chip
        chat={chat}
        label={t('chat.reasoning')}
        value={current ? t(current[1]) : t('chat.reasoning')}
      />
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={4}
          className="z-50 min-w-40 rounded-xl bg-popover p-2 text-base text-popover-foreground"
        >
          {REASONING_LEVELS.map(([level, label]) => (
            <MenuItem
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

// A chat with no session yet uses the bot's own model; it can be changed after the first send.
function Chip({
  chat,
  label,
  value
}: {
  chat: ChatState
  label: string
  value: string
}): React.JSX.Element {
  return (
    <DropdownMenu.Trigger
      disabled={!chat.sessionId}
      aria-label={`${label}: ${value}`}
      className="flex max-w-48 items-center gap-1 rounded-full px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50 disabled:hover:bg-transparent"
    >
      <span className="truncate">{value}</span>
      <ChevronDown size={14} className="shrink-0" />
    </DropdownMenu.Trigger>
  )
}
