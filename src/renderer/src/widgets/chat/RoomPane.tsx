import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLanguage } from '@app/providers/useLanguage'
import { RoomAvatars } from '@features/bots/RoomAvatars'
import { botTitle } from '@features/bots/roster'
import { useRoster } from '@features/bots/store'
import type { Bot, Room } from '@features/bots/types'
import type { RoomActions } from '@features/chat/room'
import { parseAttachmentKey, roomItems } from '@features/chat/roomLog'
import { useRooms } from '@features/chat/roomStore'
import type { RoomTask, RoomView } from '@features/chat/types'
import { useRoomPolling } from '@features/chat/useRoomPolling'
import type { TranslationKey } from '@shared/lib/i18n'
import { ApprovalCard } from './ApprovalCard'
import { Composer } from './Composer'
import type { ComposerTarget } from './Composer'
import { Transcript } from './Transcript'

type Transcribe = (audio: { dataUrl: string; mime: string }) => Promise<string>

/** A hosted room: its log with who is answering below, then a composer without model chips. */
export function RoomPane({
  room,
  actions,
  transcribe
}: {
  room: Room
  actions: RoomActions | null
  // Dictation runs through Talyx's own profile; a room has none.
  transcribe: Transcribe | null
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const bots = useRoster((state) => state.snapshot.bots)
  const view = useRooms((state) => state.rooms[room.room_id])
  const roomId = room.room_id
  const lastSeq = view?.lastSeq ?? 0
  useRoomPolling(actions, roomId)

  // What you read here must not come back as unread once you leave.
  useEffect(() => {
    if (lastSeq) useRoster.getState().seeRoom(roomId, lastSeq)
  }, [roomId, lastSeq])

  const memberOf = useCallback((member: string) => roomMember(room, bots, member), [room, bots])
  const nameOf = (member: string): string => memberOf(member).name
  const events = view?.events
  const items = useMemo(() => roomItems(events ?? [], { memberOf, t }), [events, memberOf, t])
  const loadImage = useCallback(
    (key: string): Promise<string> => {
      const file = parseAttachmentKey(key)
      // Other files stay a name chip; previews are for images only.
      if (!actions || file?.kind !== 'image') return Promise.reject(new Error('No preview'))
      return actions.image(roomId, file)
    },
    [actions, roomId]
  )

  if (!actions || !transcribe || !view || (view.loading && !view.events.length))
    return <p className="m-auto text-base text-muted-foreground">{t('chat.loading')}</p>

  const target: ComposerTarget = {
    placeholder: t('rooms.placeholder'),
    running: view.working,
    send: ({ text, files }) =>
      actions.send(roomId, {
        text,
        attachments: files.map((file) => ({
          attachment_id: file.id,
          kind: 'image',
          name: file.name,
          mime: file.mime,
          size: file.size
        }))
      }),
    upload: async (file, dataUrl) => {
      const stored = await actions.uploadImage(roomId, {
        dataUrl,
        name: file.name,
        mime: file.type
      })
      return { id: stored.attachment_id, name: stored.name, mime: stored.mime, size: stored.size }
    },
    transcribe,
    stop: () => void actions.stop(roomId)
  }

  return (
    <>
      {items.length || view.tasks.length ? (
        <Transcript items={items} loadImage={loadImage}>
          {view.tasks.map((task) => (
            <li key={`${task.kind}:${task.task_id}:${task.execution_generation}`}>
              <TaskCard
                task={task}
                name={nameOf(task.member_id)}
                onApprove={(choice) => void actions.approve(roomId, task, choice)}
                onSettle={() => void actions.settle(roomId, task)}
              />
            </li>
          ))}
        </Transcript>
      ) : (
        <div className="grid flex-1 place-content-center justify-items-center gap-4 px-8 text-center">
          <RoomAvatars room={room} bots={bots} size={44} />
          <h1 className="text-2xl font-semibold">{room.name}</h1>
          <p className="max-w-sm text-base">{t('rooms.empty')}</p>
        </div>
      )}
      <p
        role="status"
        className="mx-auto w-full max-w-3xl px-6 pb-2 text-sm text-muted-foreground empty:hidden"
      >
        {activityLine(view, nameOf, t)}
      </p>
      {view.error && (
        <p className="mx-auto w-full max-w-3xl px-6 pb-2 text-base text-destructive" role="alert">
          {view.error}{' '}
          <button className="underline" onClick={() => void actions.refresh(roomId)}>
            {t('chat.retry')}
          </button>
        </p>
      )}
      {view.live ? (
        <Composer target={target} />
      ) : (
        <p className="mx-auto w-full max-w-3xl px-6 pb-6 text-base">{t('rooms.readOnly')}</p>
      )}
    </>
  )
}

// A member's name as the roster shows it. Never its handle: Talyx's handle in rooms made by
// other clients is not a name to show.
function roomMember(room: Room, bots: Bot[], memberId: string): { name: string; profile: string } {
  const member = room.members.find((item) => (item.member_id ?? item.profile) === memberId)
  const profile = member?.profile ?? memberId
  const bot = bots.find((item) => item.name === profile)
  return { name: bot ? botTitle(bot) : member?.display_name || profile, profile }
}

function activityLine(
  view: RoomView,
  nameOf: (member: string) => string,
  t: (key: TranslationKey) => string
): string {
  const named = (phase: string): string[] =>
    Object.entries(view.phases)
      .filter(([, value]) => value === phase)
      .map(([member]) => nameOf(member))
  const working = named('working')
  const queued = named('queued')
  return [
    working.length ? t('rooms.working').replace('{names}', working.join(', ')) : '',
    queued.length ? t('rooms.queued').replace('{names}', queued.join(', ')) : ''
  ]
    .filter(Boolean)
    .join(' · ')
}

/** A member's turn that waits on you: an approval card, or a stalled turn to retry or discard. */
function TaskCard({
  task,
  name,
  onApprove,
  onSettle
}: {
  task: RoomTask
  name: string
  onApprove: (choice: 'once' | 'deny') => void
  onSettle: () => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [confirming, setConfirming] = useState(false)
  if (task.kind === 'approval')
    return (
      <ApprovalCard
        prompt={{
          kind: 'approval',
          id: task.task_id,
          command: task.command,
          description: task.description,
          // A room member's approval takes only these two answers.
          choices: ['deny', 'once'],
          respond: () => undefined
        }}
        botName={name}
        onAnswer={(choice) => onApprove(choice === 'once' ? 'once' : 'deny')}
      />
    )
  const discard = task.kind === 'discard'
  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-secondary p-5">
      <p className="text-base">
        {confirming
          ? t('rooms.discardWarning')
          : t(discard ? 'rooms.discardTitle' : 'rooms.retryTitle').replace('{name}', name)}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => (discard && !confirming ? setConfirming(true) : onSettle())}
          className="rounded-full bg-primary px-5 py-2 text-base text-primary-foreground"
        >
          {t(discard ? 'rooms.discard' : 'rooms.retry')}
        </button>
        {confirming && (
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-full bg-background px-5 py-2 text-base hover:bg-accent"
          >
            {t('roster.cancel')}
          </button>
        )}
      </div>
    </section>
  )
}
