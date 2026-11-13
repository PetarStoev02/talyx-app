import { useEffect } from 'react'
import { useLanguage } from '@app/providers/useLanguage'
import { BotAvatar } from '@features/bots/BotAvatar'
import { RoomAvatars } from '@features/bots/RoomAvatars'
import { botTitle } from '@features/bots/roster'
import { useRoster } from '@features/bots/store'
import { samePlace, snippetOf } from '@features/chat/botSearch'
import type { MessageHit, SearchPlace } from '@features/chat/botSearch'
import { cn } from '@shared/lib/utils'

/**
 * The messages a search found, under its field: grouped by place (the open chat first, then each
 * group chat), each a one-line snippet around the match. The field keeps focus; Up and Down move
 * the active row (aria-activedescendant), Enter or a click picks it.
 */
export function SearchResults({
  id,
  hits,
  here,
  active,
  follow,
  note,
  onPick,
  onHover
}: {
  id: string
  hits: MessageHit[]
  // The open chat or room: its group is "This chat".
  here: SearchPlace
  active: number
  // The active row moved by Up and Down: keep it in view.
  follow: boolean
  // A line under the list: still reading, a room that could not be read, a cap.
  note: string
  onPick: (hit: MessageHit) => void
  onHover: (index: number) => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const bots = useRoster((s) => s.snapshot.bots)
  const rooms = useRoster((s) => s.snapshot.rooms)

  // Up and Down keep the row they reach in view.
  useEffect(() => {
    if (follow && active >= 0)
      document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [id, active, follow])

  return (
    // Holds pointer focus in the field, so a click on a row does not first close the list.
    <div
      onMouseDown={(event) => event.preventDefault()}
      className="chat-search-list absolute top-full right-0 z-30 mt-2 w-[min(28rem,calc(100cqw-1rem))] overflow-hidden rounded-xl border border-border bg-popover shadow-lg"
    >
      <div
        id={id}
        role="listbox"
        aria-label={t('search.results')}
        className="max-h-[60vh] overflow-y-auto overscroll-contain p-2 empty:hidden"
      >
        {groupsOf(hits).map((group) => {
          const room =
            group.place.kind === 'room'
              ? rooms.find((item) => item.room_id === group.place.id)
              : undefined
          const bot =
            group.place.kind === 'bot'
              ? bots.find((item) => item.name === group.place.id)
              : undefined
          const name = samePlace(group.place, here)
            ? t('search.thisChat')
            : (room?.name ?? (bot ? botTitle(bot) : group.place.id))
          const headingId = `${id}-${group.place.kind}-${group.first}`
          return (
            <div key={headingId} role="group" aria-labelledby={headingId}>
              <p
                id={headingId}
                className="flex items-center gap-2 px-3 pt-2 pb-1 text-sm text-muted-foreground"
              >
                <span aria-hidden="true" className="flex">
                  {room ? (
                    <RoomAvatars room={room} bots={bots} size={12} cluster={16} />
                  ) : bot ? (
                    <BotAvatar bot={bot} place="row" size={16} />
                  ) : null}
                </span>
                {name}
              </p>
              {group.hits.map((hit, offset) => {
                const index = group.first + offset
                return (
                  <div
                    key={hit.messageId}
                    id={`${id}-${index}`}
                    role="option"
                    aria-selected={index === active}
                    onMouseMove={() => onHover(index)}
                    onClick={() => onPick(hit)}
                    className={cn(
                      'flex cursor-default items-center rounded-lg px-3 py-2',
                      // The row Enter picks: a ring as well as the tint, which alone is too faint.
                      index === active && 'bg-secondary outline-2 -outline-offset-2 outline-ring'
                    )}
                  >
                    <Snippet hit={hit} you={t('search.you')} />
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
      {/* Always in the page, empty or not (never display: none), so a screen reader hears the note
          when it comes, such as a room that could not be read. */}
      <p
        role="status"
        className="border-t border-border px-4 py-2 text-sm text-muted-foreground empty:border-0 empty:p-0"
      >
        {note}
      </p>
    </div>
  )
}

function Snippet({ hit, you }: { hit: MessageHit; you: string }): React.JSX.Element {
  const { before, match, after } = snippetOf(hit.text, hit.match)
  const author = hit.fromYou ? you : hit.sender
  return (
    <p className="min-w-0 flex-1 truncate text-base">
      {author && <span className="text-muted-foreground">{`${author}: `}</span>}
      {before}
      <mark className="search-hit">{match}</mark>
      {after}
    </p>
  )
}

// Consecutive hits in one place, with the list index of each group's first hit.
function groupsOf(hits: MessageHit[]): { place: SearchPlace; first: number; hits: MessageHit[] }[] {
  const groups: { place: SearchPlace; first: number; hits: MessageHit[] }[] = []
  hits.forEach((hit, index) => {
    const last = groups.at(-1)
    if (last && samePlace(last.place, hit.place)) last.hits.push(hit)
    else groups.push({ place: hit.place, first: index, hits: [hit] })
  })
  return groups
}
