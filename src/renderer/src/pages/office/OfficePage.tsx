import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useNavigation } from '@app/providers/useNavigation'
import { useOffice } from '@app/providers/useOffice'
import { BotCard } from '@features/bot-card/BotCard'
import { GiveTaskForm } from '@features/bot-card/GiveTaskForm'
import { ChatPanel, GroupChatHeader } from '@features/chat/ChatPanel'
import { EventFeed } from '@widgets/event-feed/EventFeed'
import { TopBar } from '@widgets/office-hud/TopBar'
import { OfficeScene } from '@widgets/office-scene'
import { RosterPanel } from '@widgets/roster-panel/RosterPanel'
import type { ConversationTarget, OfficeSnapshot } from '../../../../shared/office'

export function OfficePage(): React.JSX.Element {
  const { snapshot, selection, load, select, subscribe } = useOffice()
  const navigate = useNavigation((s) => s.navigate)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = subscribe()
    load(null).catch((err: unknown) =>
      setError(err instanceof Error ? err.message : 'Could not load the office')
    )
    return unsubscribe
  }, [load, subscribe])

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') select(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [select])

  async function handleSwitchProject(projectId: string): Promise<void> {
    try {
      select(null)
      await window.api.updateSettings({ currentProjectId: projectId })
      await load(projectId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not switch project')
    }
  }

  const selectedBotId = selection?.kind === 'bot' ? selection.botId : null

  return (
    <div className="relative h-screen w-screen bg-black font-sans text-white">
      {snapshot ? (
        <>
          <OfficeScene snapshot={snapshot} selectedBotId={selectedBotId} onSelect={select} />
          <TopBar
            snapshot={snapshot}
            onSwitchProject={handleSwitchProject}
            onOpenSettings={() => navigate('settings')}
            onSelect={select}
          />
          {!selection && (
            <RosterPanel snapshot={snapshot} selectedBotId={selectedBotId} onSelect={select} />
          )}
          <EventFeed snapshot={snapshot} />
          {selection && (
            <OfficeChat snapshot={snapshot} target={selection} onClose={() => select(null)} />
          )}
        </>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-[#949494]">
          {error ?? 'Talyx'}
        </div>
      )}
    </div>
  )
}

/** The chat panel for the selected room or bot; nothing if it has gone from the snapshot. */
function OfficeChat({
  snapshot,
  target,
  onClose
}: {
  snapshot: OfficeSnapshot
  target: ConversationTarget
  onClose: () => void
}): React.JSX.Element | null {
  if (target.kind === 'group') {
    const group = snapshot.groups.find((g) => g.id === target.groupId)
    if (!group) return null
    const members = snapshot.bots.filter((b) => b.groupIds.includes(group.id))
    return (
      <ChatPanel
        key={group.id}
        target={target}
        bots={snapshot.bots}
        header={<GroupChatHeader name={group.name} members={members} onClose={onClose} />}
        composerExtra={null}
      />
    )
  }
  const bot = snapshot.bots.find((b) => b.id === target.botId)
  if (!bot) return null
  return (
    <ChatPanel
      key={bot.id}
      target={target}
      bots={snapshot.bots}
      header={
        <BotCard
          bot={bot}
          roomName={snapshot.rooms.find((r) => r.id === bot.placement.roomId)?.name ?? ''}
          groupNames={snapshot.groups.filter((g) => bot.groupIds.includes(g.id)).map((g) => g.name)}
          onClose={onClose}
        />
      }
      composerExtra={{
        label: 'Send as task',
        render: (close) => (
          <GiveTaskForm bot={bot} t3Projects={snapshot.t3Projects} onClose={close} />
        )
      }}
    />
  )
}
