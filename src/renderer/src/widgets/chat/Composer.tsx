import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { DropdownMenu } from 'radix-ui'
import { ArrowUp, ChevronDown, LoaderCircle, Mic, Plus, Square, X } from 'lucide-react'
import { toast } from 'sonner'
import { useLanguage } from '@app/providers/useLanguage'
import { useNavigation } from '@app/providers/useNavigation'
import { baseName, sortAttachments } from '@features/chat/attachments'
import type { ChatActions } from '@features/chat/chat'
import type { ChatState } from '@features/chat/store'
import { dataUrlOf, dictationProblem, useDictation } from '@features/chat/useDictation'
import { openSettings } from '@features/settings/sections'
import { problemOf, problemText } from '@shared/lib/problem'
import { cn } from '@shared/lib/utils'
import { IconButton } from '@shared/ui/IconButton'
import { ModelPicker } from '@shared/ui/ModelPicker'
import { CheckItem, menuContentClass } from '@shared/ui/menu'
import type { TranslationKey } from '@shared/lib/i18n'
import { composerWanted } from './focusComposer'

const MAX_ROWS = 8
// Every round icon button in the composer: one circle, one icon size.
const iconButton = 'inline-flex size-9 shrink-0 items-center justify-center rounded-full'
const ICON_SIZE = 18
// Electron says where a file is on disk; a page in a plain browser (the dev bridge) cannot.
const pathOf = (file: File): string => window.electron?.pathOf?.(file) ?? ''
const REASONING_LEVELS: Array<[string, TranslationKey]> = [
  ['low', 'chat.reasoningLow'],
  ['medium', 'chat.reasoningMedium'],
  ['high', 'chat.reasoningHigh']
]

/** A file attached to the draft: a bot chat's upload path, or a room attachment id. */
export interface ComposerFile {
  id: string
  name: string
  mime: string
  size: number
}

/** Where the composer sends: a bot's chat or a room. */
export interface ComposerTarget {
  placeholder: string
  running: boolean
  /**
   * False when nothing was sent; the composer gets the draft back. A message sent while the bot or
   * room answers waits its turn instead of cutting in.
   */
  // `paths`: files and folders on this computer; each target joins them to the text its own way.
  send: (draft: { text: string; files: ComposerFile[]; paths: string[] }) => Promise<boolean>
  upload: (file: File, dataUrl: string) => Promise<ComposerFile>
  transcribe: (audio: { dataUrl: string; mime: string }) => Promise<string>
  stop: () => void
}

export function Composer({
  target,
  inputRef,
  seed = null,
  children
}: {
  target: ComposerTarget
  // The text field, for a pane that hands focus back to it.
  inputRef?: React.Ref<HTMLTextAreaElement>
  // Text a starter puts in the box; each new object replaces the draft.
  seed?: { text: string } | null
  // Chips between the + and the mic, such as the bot chat's model and reasoning level.
  children?: React.ReactNode
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const navigate = useNavigation((s) => s.navigate)
  const [text, setText] = useState('')
  const [files, setFiles] = useState<ComposerFile[]>([])
  // Files and folders that go by their path on this computer: each joins the text on send.
  const [paths, setPaths] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  // A new seed fills the draft once, while rendering (no effect round trip).
  const [seenSeed, setSeenSeed] = useState(seed)
  if (seed !== seenSeed) {
    setSeenSeed(seed)
    // Added under a draft already typed (an edited waiting message), never over it.
    if (seed) setText(text.trim() ? `${text}\n${seed.text}` : seed.text)
  }
  const picker = useRef<HTMLInputElement>(null)
  // While an answer runs, a new message queues behind it; only a send still on its way waits.
  const running = target.running
  const dictation = useDictation(
    target.transcribe,
    (words) => setText((current) => (current.trim() ? `${current}\n${words}` : words)),
    (error) => {
      const problem = dictationProblem(error)
      toast.error(t(problem.key), {
        description: problem.detail ?? undefined,
        duration: Infinity,
        action:
          problem.key === 'chat.dictationNoProvider'
            ? { label: t('chat.openSettings'), onClick: () => openSettings('providers', navigate) }
            : undefined
      })
    }
  )

  const draft = !!text.trim() || files.length > 0 || paths.length > 0

  async function send(): Promise<void> {
    if (sending || !draft) return
    const attached = files
    const linked = paths
    setText('')
    setFiles([])
    setPaths([])
    setSending(true)
    const sent = await target
      .send({ text, files: attached, paths: linked })
      .finally(() => setSending(false))
    if (sent) return
    // A failed send gives the draft back, unless something new was typed meanwhile.
    setText((current) => current || text)
    setFiles((current) => (current.length ? current : attached))
    setPaths((current) => (current.length ? current : linked))
  }

  async function attach(list: Iterable<File>): Promise<void> {
    const { images, paths: linked, refused } = sortAttachments(list, pathOf)
    setPaths((current) => [...new Set([...current, ...linked])])
    if (refused.length)
      toast.error(
        t('chat.attachFailed').replace('{name}', refused.map((file) => file.name).join(', ')),
        { description: t('chat.notOnDisk') }
      )
    for (const file of images) {
      try {
        const attached = await target.upload(file, await dataUrlOf(file))
        setFiles((current) => [...current, attached])
      } catch (error) {
        toast.error(t('chat.attachFailed').replace('{name}', file.name), {
          description: problemText(t, problemOf(error)),
          duration: Infinity
        })
      }
    }
  }

  // Files dropped anywhere on the chat, transcript included, land here: the composer's parent is
  // the whole chat area (the panes render as fragments into it).
  const form = useRef<HTMLFormElement>(null)
  const attachDropped = useEffectEvent((files: FileList) => void attach(files))
  useEffect(() => {
    const area = form.current?.parentElement
    if (!area) return
    const over = (event: DragEvent): void => {
      // Only a drag of files: selected text or a link still drops into the text field.
      if (!event.dataTransfer?.types.includes('Files')) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    }
    const drop = (event: DragEvent): void => {
      if (!event.dataTransfer?.types.includes('Files')) return
      event.preventDefault()
      attachDropped(event.dataTransfer.files)
    }
    area.addEventListener('dragover', over)
    area.addEventListener('drop', drop)
    return () => {
      area.removeEventListener('dragover', over)
      area.removeEventListener('drop', drop)
    }
  }, [])

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    void send()
  }

  return (
    <form
      ref={form}
      className="mx-auto w-full max-w-3xl px-6 pb-6"
      onSubmit={(event) => {
        event.preventDefault()
        void send()
      }}
    >
      <div className="chat-composer flex flex-col gap-2 rounded-3xl bg-secondary p-3">
        {(files.length > 0 || paths.length > 0) && (
          <ul className="flex flex-wrap gap-2">
            {files.map((image) => (
              <AttachedChip
                key={image.id}
                name={image.name}
                title={null}
                onRemove={() => setFiles((current) => current.filter((item) => item !== image))}
              />
            ))}
            {paths.map((path) => (
              <AttachedChip
                key={path}
                name={baseName(path)}
                title={path}
                onRemove={() => setPaths((current) => current.filter((item) => item !== path))}
              />
            ))}
          </ul>
        )}
        <textarea
          ref={inputRef}
          data-composer
          // Focus asked for (⌘L) before this box was on the page.
          autoFocus={composerWanted()}
          value={text}
          rows={1}
          aria-label={target.placeholder}
          placeholder={target.placeholder}
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
        <div className="flex flex-wrap items-center gap-1">
          <IconButton
            type="button"
            label={t('chat.addFiles')}
            onClick={() => picker.current?.click()}
            className="text-foreground"
          >
            <Plus size={ICON_SIZE} />
          </IconButton>
          <input
            ref={picker}
            type="file"
            multiple
            hidden
            onChange={(event) => {
              void attach(event.target.files ?? [])
              event.target.value = ''
            }}
          />
          {children}
          {/* Mic and send wrap together, so a narrow window never pushes Send out of reach. */}
          <div className="ml-auto flex items-center gap-1">
            <IconButton
              type="button"
              label={
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
                'text-foreground',
                dictation.state === 'recording' &&
                  'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
              )}
            >
              {dictation.state === 'transcribing' ? (
                <LoaderCircle size={ICON_SIZE} className="animate-spin" />
              ) : (
                <Mic size={ICON_SIZE} />
              )}
            </IconButton>
            {running && (
              <button
                type="button"
                aria-label={t('chat.stop')}
                onClick={target.stop}
                className={cn(
                  iconButton,
                  // With a draft to send, Send is the main button and Stop steps back.
                  draft ? 'hover:bg-foreground/10' : 'bg-primary text-primary-foreground'
                )}
              >
                <Square size={ICON_SIZE - 4} fill="currentColor" />
              </button>
            )}
            {(!running || draft) && (
              <button
                type="submit"
                aria-label={running ? t('chat.sendQueued') : t('chat.send')}
                disabled={!draft || sending}
                className={cn(iconButton, 'bg-primary text-primary-foreground disabled:opacity-50')}
              >
                <ArrowUp size={ICON_SIZE} />
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  )
}

// One thing attached to the draft, an image or a file on this computer, with a way to take it off.
function AttachedChip({
  name,
  title,
  onRemove
}: {
  name: string
  // The full path of a file on this computer, shown on hover.
  title: string | null
  onRemove: () => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  return (
    <li
      title={title ?? undefined}
      className="flex items-center gap-1 rounded-full bg-background py-1 pr-1 pl-3 text-sm"
    >
      {name}
      <button
        type="button"
        aria-label={t('chat.removeAttachment').replace('{name}', name)}
        onClick={onRemove}
        className="rounded-full p-1 hover:bg-foreground/10"
      >
        <X size={14} />
      </button>
    </li>
  )
}

interface ChipMenuProps {
  chat: ChatState
  actions: ChatActions
  // The composer's text field: closing a chip's menu puts focus back there, not on the chip.
  returnFocusTo: React.RefObject<HTMLTextAreaElement | null>
}

/** The bot chat's model and reasoning chips. */
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
