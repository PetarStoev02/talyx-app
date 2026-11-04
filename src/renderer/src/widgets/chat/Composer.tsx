import { useRef, useState } from 'react'
import { DropdownMenu } from 'radix-ui'
import { ArrowUp, ChevronDown, Plus, Square, X } from 'lucide-react'
import { toast } from 'sonner'
import { useLanguage } from '@app/providers/useLanguage'
import type { ChatActions, ChatImage } from '@features/chat/chat'
import type { ChatState } from '@features/chat/store'
import type { ModelOptionProvider } from '@shared/engine/gateway-events'
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
  const picker = useRef<HTMLInputElement>(null)
  const running = chat.transcript?.running === true
  const { profile } = chat

  async function send(): Promise<void> {
    if (running || (!text.trim() && !images.length)) return
    const draft = { text, images: images.map(({ path, mime }) => ({ path, mime })) }
    setText('')
    setImages([])
    await actions.send(profile, draft)
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
  const [providers, setProviders] = useState<ModelOptionProvider[] | null>(null)

  function load(open: boolean): void {
    if (!open || providers) return
    actions
      .models(chat.profile)
      .then(setProviders)
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : String(error))
      )
  }

  return (
    <DropdownMenu.Root onOpenChange={load}>
      <Chip label={t('chat.model')} value={chat.info.model ?? t('chat.modelDefault')} />
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={4}
          className="z-50 max-h-80 min-w-56 overflow-y-auto rounded-xl bg-popover p-2 text-base text-popover-foreground"
        >
          {!providers && (
            <p className="px-3 py-2 text-muted-foreground">{t('chat.modelsLoading')}</p>
          )}
          {providers?.map((provider) => (
            <DropdownMenu.Group key={provider.slug}>
              <DropdownMenu.Label className="px-3 pt-2 text-sm text-muted-foreground">
                {provider.name}
              </DropdownMenu.Label>
              {(provider.models ?? []).map((model) => (
                <MenuItem
                  key={model}
                  label={model}
                  selected={chat.info.model === model && chat.info.provider === provider.slug}
                  onSelect={() =>
                    void actions.setModel(chat.profile, { model, provider: provider.slug })
                  }
                />
              ))}
            </DropdownMenu.Group>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
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
      <Chip label={t('chat.reasoning')} value={current ? t(current[1]) : t('chat.reasoning')} />
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

function Chip({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <DropdownMenu.Trigger
      aria-label={`${label}: ${value}`}
      className="flex max-w-48 items-center gap-1 rounded-full px-3 py-1.5 text-sm hover:bg-accent"
    >
      <span className="truncate">{value}</span>
      <ChevronDown size={14} className="shrink-0" />
    </DropdownMenu.Trigger>
  )
}

function MenuItem({
  label,
  selected,
  onSelect
}: {
  label: string
  selected: boolean
  onSelect: () => void
}): React.JSX.Element {
  return (
    <DropdownMenu.CheckboxItem
      checked={selected}
      onSelect={onSelect}
      className="cursor-default rounded-lg px-3 py-2 outline-none data-[highlighted]:bg-accent data-[state=checked]:font-medium"
    >
      {label}
    </DropdownMenu.CheckboxItem>
  )
}

function dataUrlOf(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsDataURL(file)
  })
}
