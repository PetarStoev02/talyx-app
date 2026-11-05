import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useLanguage } from '@app/providers/useLanguage'
import { BotAvatar } from '@features/bots/BotAvatar'
import { RoomAvatars } from '@features/bots/RoomAvatars'
import { botTitle } from '@features/bots/roster'
import { useRoster } from '@features/bots/store'
import type { Bot, Room } from '@features/bots/types'
import type { ChatActions } from '@features/chat/chat'
import { answering } from '@features/chat/room'
import type { RoomActions } from '@features/chat/room'
import { parseAttachmentKey, roomItems } from '@features/chat/roomLog'
import { useRooms } from '@features/chat/roomStore'
import type { RoomTask, RoomView } from '@features/chat/types'
import { useRoomPolling } from '@features/chat/useRoomPolling'
import { useRefocus } from '@shared/hooks/useRefocus'
import type { TranslationKey } from '@shared/lib/i18n'
import { listOf } from '@shared/lib/list'
import { reportError } from '@shared/lib/report'
import { Button } from '@shared/ui/button'
import { ModelPicker } from '@shared/ui/ModelPicker'
import { ApprovalCard } from './ApprovalCard'
import { Chip, Composer } from './Composer'
import type { ComposerTarget } from './Composer'
import { Transcript } from './Transcript'

/** A hosted room: its log with who is answering below, then a composer with the room's model. */
export function RoomPane({
  room,
  actions,
  chat
}: {
  room: Room
  actions: RoomActions | null
  // Dictation and the model list run through Talyx's own profile; a room has none.
  chat: ChatActions | null
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const bots = useRoster((state) => state.snapshot.bots)
  const view = useRooms((state) => state.rooms[room.room_id])
  const roomId = room.room_id
  const lastSeq = view?.lastSeq ?? 0
  const working = view?.working ?? false
  const memberKey = room.members.map((member) => member.profile).join(',')
  const composer = useRef<HTMLTextAreaElement>(null)
  useRoomPolling(actions, roomId)
  // A settled card unmounts with focus on it; the composer is where the room goes on.
  useRefocus(composer, view?.tasks.length)

  // Read on open and after each round: a member's room session exists from its first answer on.
  useEffect(() => {
    if (!actions || working) return
    const members = memberKey.split(',').map((profile) => ({ profile }))
    void actions.readModel(roomId, members)
  }, [actions, roomId, memberKey, working])

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

  if (!actions || !chat || !view || (view.loading && !view.events.length))
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
    transcribe: (audio) => chat.transcribe('default', audio),
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
        className="mx-auto flex w-full max-w-3xl items-center gap-2 px-6 pb-2 text-sm text-muted-foreground empty:hidden"
      >
        {answering(room, view.phases).map((profile) => (
          <BotAvatar
            key={profile}
            bot={bots.find((item) => item.name === profile) ?? { name: profile, meta: {} }}
            place="row"
            speaking
          />
        ))}
        {activityLine(view, nameOf, t)}
      </p>
      {/* The composer's Send or the card's own button is the retry for these. */}
      {view.actionError && (
        <div className="mx-auto w-full max-w-3xl px-6 pb-2 text-base" role="alert">
          <p className="text-destructive-text">{t(view.actionError.key)}</p>
          {view.actionError.detail && (
            <p className="text-sm text-muted-foreground wrap-anywhere">{view.actionError.detail}</p>
          )}
        </div>
      )}
      {view.error && (
        <div className="mx-auto w-full max-w-3xl px-6 pb-2 text-base" role="alert">
          <p className="text-destructive-text">
            {t(view.error.key)}{' '}
            <button
              className="underline underline-offset-4 hover:decoration-2"
              onClick={() => void actions.refresh(roomId)}
            >
              {t('action.tryAgain')}
            </button>
          </p>
          {view.error.detail && (
            <p className="text-sm text-muted-foreground wrap-anywhere">{view.error.detail}</p>
          )}
        </div>
      )}
      {view.live ? (
        <Composer target={target} inputRef={composer}>
          <RoomModelMenu room={room} view={view} actions={actions} chat={chat} nameOf={nameOf} />
        </Composer>
      ) : (
        <p className="mx-auto w-full max-w-3xl px-6 pb-6 text-base">{t('rooms.readOnly')}</p>
      )}
    </>
  )
}

// One model for the whole room: every idle member's room session switches to it.
function RoomModelMenu({
  room,
  view,
  actions,
  chat,
  nameOf
}: {
  room: Room
  view: RoomView
  actions: RoomActions
  chat: ChatActions
  nameOf: (member: string) => string
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  // One switch at a time: a second pick during one would race its own fences.
  const [switching, setSwitching] = useState(false)
  const [shared] = view.models
  const value = view.models.length > 1 ? t('rooms.modelMixed') : (shared ?? t('rooms.modelOwn'))

  async function switchAll(choice: { model: string; provider: string }): Promise<void> {
    setSwitching(true)
    try {
      const { skipped } = await actions.setModel(room.room_id, room.members, choice)
      if (skipped.length)
        toast(t('rooms.modelSkipped').replace('{names}', listOf(skipped.map(nameOf))))
    } catch (error) {
      // setModel keeps member failures on the room; anything else is Talyx's own and logged.
      reportError('room', error)
    } finally {
      setSwitching(false)
    }
  }

  return (
    <ModelPicker
      load={() => chat.models('default')}
      // The members' reading has model names only, so no provider entry is marked.
      selected={null}
      onSelect={(choice) => void switchAll(choice)}
      labels={{ loading: t('chat.modelsLoading'), failed: t('chat.modelsFailed') }}
    >
      {/* Before any member has answered there is no room session to switch. */}
      <Chip label={t('chat.model')} value={value} disabled={!shared || switching} />
    </ModelPicker>
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
    working.length ? t('rooms.working').replace('{names}', listOf(working)) : '',
    queued.length ? t('rooms.queued').replace('{names}', listOf(queued)) : ''
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
        <Button
          type="button"
          variant={confirming ? 'destructive' : 'default'}
          onClick={() => (discard && !confirming ? setConfirming(true) : onSettle())}
        >
          {t(discard ? 'rooms.discard' : 'rooms.retry')}
        </Button>
        {confirming && (
          <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
            {t('roster.cancel')}
          </Button>
        )}
      </div>
    </section>
  )
}
