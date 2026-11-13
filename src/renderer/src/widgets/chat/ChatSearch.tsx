import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore
} from 'react'
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import { useLanguage } from '@app/providers/useLanguage'
import { useRoster } from '@features/bots/store'
import { cutShort, MOST_PER_PLACE, samePlace } from '@features/chat/botSearch'
import type { MessageHit, SearchPlace } from '@features/chat/botSearch'
import { useFind } from '@features/chat/findStore'
import { findMatches, pointIn } from '@features/chat/search'
import { dialogOpen, platformOf, shortcutOf } from '@features/shortcuts/shortcuts'
import { SearchResults } from './SearchResults'
import { cn } from '@shared/lib/utils'

const platform = platformOf(navigator.platform)
const ALL = 'chat-search'
const CURRENT = 'chat-search-current'

/** What a search found for its words: the messages, and a line to show under them. */
export interface SearchFound {
  hits: MessageHit[]
  note: string
}

/**
 * The one search, on the name pill's line in a bot's chat and in a room. It highlights the words
 * in the open chat (Enter and Shift+Enter, or the arrows, step through them) and lists the
 * messages that have them under the field, here and, for a bot, in its group chats; picking one
 * goes to it. Escape closes the list, then the search. Opening it loads the whole history first,
 * so it covers every message. Matches are painted with the CSS Highlight API, so the transcript's
 * markup is never touched.
 */
export function ChatSearch({
  transcript,
  place,
  label,
  start,
  find,
  loadWhole,
  onClose
}: {
  // The element whose text is highlighted, and the chat or room it shows.
  transcript: HTMLElement
  place: SearchPlace
  // What the field searches, as its accessible name says.
  label: string
  // The words to find at once, and the message whose first match the search starts on.
  start: { query: string; messageId: string | null }
  // The messages that have the words, here and elsewhere.
  find: (query: string) => SearchFound
  loadWhole: () => Promise<void>
  onClose: () => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const input = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState(start.query)
  const [loading, setLoading] = useState(true)
  // Null until you step: the search stays on the start message's first match as the chat loads.
  const [current, setCurrent] = useState<number | null>(null)
  // The match last scrolled to: new text in the chat repaints the matches but does not scroll.
  const scrolled = useRef('')
  // The list of messages under the field, and its active row (none: -1, Enter steps instead).
  const [listOpen, setListOpen] = useState(!!start.query && !start.messageId)
  // The active row, by its message: a new reply reorders the list but keeps the row. `byKeys`: Up
  // and Down moved it, so the list scrolls to it; a hover does not scroll the list under the mouse.
  const [activeRow, setActiveRow] = useState<{ id: string; byKeys: boolean } | null>(null)
  const listId = useId()
  const found = useMemo(() => find(query), [find, query])

  useEffect(() => {
    let live = true
    void loadWhole().finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [loadWhole])

  // ⌘F again while it is open puts the cursor back in the field.
  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (shortcutOf(event, platform) !== 'searchChat' || dialogOpen()) return
      event.preventDefault()
      input.current?.focus()
      input.current?.select()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Any change to the transcript's text finds the matches again: a new reply, the whole history.
  const edits = useSyncExternalStore(
    useCallback((changed) => watchText(transcript, changed), [transcript]),
    () => editCount.get(transcript) ?? 0
  )
  const matches = useMemo(() => {
    void edits // the matches are read from the page, so each edit finds them again
    return rangesOf(transcript, query)
  }, [transcript, query, edits])

  const startAt = useMemo(
    () => (start.messageId ? matchIn(transcript, matches, start.messageId) : 0),
    [transcript, matches, start.messageId]
  )
  const shown = matches.length ? Math.min(current ?? startAt, matches.length - 1) : -1

  useEffect(() => {
    CSS.highlights.set(ALL, new Highlight(...matches))
    const range = matches[shown]
    if (!range) return void CSS.highlights.delete(CURRENT)
    CSS.highlights.set(CURRENT, new Highlight(range))
    // The whole history arriving moves match 1 to an older message: that counts as a new place.
    const place = `${loading}\n${query}\n${shown}`
    if (scrolled.current === place) return
    scrolled.current = place
    range.startContainer.parentElement?.scrollIntoView({ block: 'center' })
  }, [matches, shown, query, loading])

  useEffect(
    () => () => {
      CSS.highlights.delete(ALL)
      CSS.highlights.delete(CURRENT)
    },
    []
  )

  const hits = found.hits
  const listShown = listOpen && !!query.trim() && (hits.length > 0 || !!found.note)
  const active = activeRow ? hits.findIndex((hit) => rowId(hit) === activeRow.id) : -1
  const setActive = (index: number, byKeys: boolean): void =>
    setActiveRow(hits[index] ? { id: rowId(hits[index]), byKeys } : null)
  // Stepping shows the match the count points at, so the list stops covering the chat.
  const step = (by: number): void => {
    setListOpen(false)
    if (matches.length) setCurrent((shown + by + matches.length) % matches.length)
  }

  // A message here: the highlight moves to it. Elsewhere: that chat or room opens with this search.
  function pick(hit: MessageHit): void {
    setListOpen(false)
    setActiveRow(null)
    if (samePlace(hit.place, place)) {
      // Picked again after scrolling away: scroll to it again.
      scrolled.current = ''
      return setCurrent(matchIn(transcript, matches, hit.messageId))
    }
    useFind.getState().ask({ place: hit.place, query, messageId: hit.messageId })
    useRoster.getState().select(hit.place)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    // A key that confirms a word in an input method is not for the search.
    if (event.nativeEvent.isComposing) return
    const move = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
    // Down brings the list back after a pick or Escape; typing does too.
    if (move === 1 && !listShown && query.trim()) {
      event.preventDefault()
      setListOpen(true)
    } else if (move && listShown && hits.length) {
      event.preventDefault()
      // -1 is the field itself: past the last row comes back to it, and up from it to the last.
      const next = active + move
      setActive(next >= hits.length ? -1 : next < -1 ? hits.length - 1 : next, true)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (listShown && hits[active]) pick(hits[active])
      else step(event.shiftKey ? -1 : 1)
    }
  }

  // Escape closes the list first, then the search, from the field or any of its buttons.
  function onBarKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (event.key !== 'Escape' || event.nativeEvent.isComposing) return
    event.preventDefault()
    if (listShown) {
      setListOpen(false)
      setActiveRow(null)
    } else onClose()
  }

  const status = loading
    ? t('chat.searchLoading')
    : !query.trim()
      ? ''
      : matches.length
        ? t('chat.searchCount')
            .replace('{current}', String(shown + 1))
            .replace('{total}', String(matches.length))
        : t('chat.searchNone')
  const button =
    'inline-flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-foreground/10 disabled:opacity-50'

  const note = [
    found.note,
    cutShort(hits) ? t('search.newest').replace('{count}', String(MOST_PER_PLACE)) : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      role="search"
      onKeyDown={onBarKeyDown}
      // Focus leaving the search (a click in the chat, Tab past it) closes the list.
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setListOpen(false)
      }}
      className="chat-search relative flex h-10 w-full max-w-sm items-center gap-1 rounded-full bg-secondary pr-1 pl-4"
    >
      <Search size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
      <input
        ref={input}
        autoFocus
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={listShown}
        aria-controls={listShown ? listId : undefined}
        aria-activedescendant={listShown && hits[active] ? `${listId}-${active}` : undefined}
        value={query}
        aria-label={label}
        placeholder={t('search.placeholder')}
        onChange={(event) => {
          setQuery(event.target.value)
          setCurrent(0)
          setListOpen(true)
          setActiveRow(null)
        }}
        onKeyDown={onKeyDown}
        // No native clear button: Escape and the close button end the search.
        className="w-0 min-w-24 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:appearance-none"
      />
      <span
        role="status"
        className="chat-search-count min-w-20 shrink-0 text-right text-sm whitespace-nowrap text-muted-foreground tabular-nums"
      >
        {status}
      </span>
      <button
        type="button"
        aria-label={t('chat.searchPrevious')}
        disabled={!matches.length}
        onClick={() => step(-1)}
        className={cn(button, 'chat-search-previous')}
      >
        <ChevronUp size={16} />
      </button>
      <button
        type="button"
        aria-label={t('chat.searchNext')}
        disabled={!matches.length}
        onClick={() => step(1)}
        className={button}
      >
        <ChevronDown size={16} />
      </button>
      <button type="button" aria-label={t('chat.searchClose')} onClick={onClose} className={button}>
        <X size={16} />
      </button>
      {listShown && (
        <SearchResults
          id={listId}
          hits={hits}
          here={place}
          active={active}
          note={note}
          follow={!!activeRow?.byKeys}
          onPick={pick}
          onHover={(index) => setActive(index, false)}
        />
      )}
    </div>
  )
}

// A hit's row key: its place and message, unique across the list.
function rowId(hit: MessageHit): string {
  return `${hit.place.kind}:${hit.place.id}:${hit.messageId}`
}

// The first match inside a message, or the first match of all when that message has none.
function matchIn(transcript: HTMLElement, matches: Range[], messageId: string): number {
  const message = transcript.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`)
  const index = message ? matches.findIndex((range) => message.contains(range.startContainer)) : -1
  return Math.max(index, 0)
}

// How many times each searched element's text has changed, as useSyncExternalStore reads it.
const editCount = new WeakMap<HTMLElement, number>()

function watchText(root: HTMLElement, changed: () => void): () => void {
  const observer = new MutationObserver(() => {
    editCount.set(root, (editCount.get(root) ?? 0) + 1)
    changed()
  })
  observer.observe(root, { subtree: true, childList: true, characterData: true })
  return () => observer.disconnect()
}

// Text inside these is the interface, not a message.
const CONTROLS = 'button, [role="button"], [aria-hidden="true"]'

// The elements a phrase never runs across; inline markup (bold, a link, code) sits inside them.
const BLOCKS = 'p, li, h1, h2, h3, h4, h5, h6, pre, td, th, blockquote, div'

// The visible text in blocks: each block's text nodes, in reading order, so a phrase split by
// formatting is still found.
function blocksOf(root: HTMLElement): Text[][] {
  const blocks: Text[][] = []
  let block: Element | null = null
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const parent = node.parentElement
    // Messages only: a control's label (Regenerate, Retry) is not part of the conversation.
    if (!parent?.checkVisibility() || parent.closest(CONTROLS)) continue
    const owner = parent.closest(BLOCKS)
    if (owner !== block || !blocks.length) blocks.push([])
    block = owner
    blocks[blocks.length - 1].push(node)
  }
  return blocks
}

function rangesOf(root: HTMLElement, query: string): Range[] {
  if (!query.trim()) return []
  const blocks = blocksOf(root)
  const texts = blocks.map((nodes) => nodes.map((node) => node.data).join(''))
  return findMatches(texts, query).map((match) => {
    const nodes = blocks[match.text]
    const lengths = nodes.map((node) => node.length)
    const start = pointIn(lengths, match.start, 'start')
    const end = pointIn(lengths, match.end, 'end')
    const range = document.createRange()
    range.setStart(nodes[start.piece], start.at)
    range.setEnd(nodes[end.piece], end.at)
    return range
  })
}
