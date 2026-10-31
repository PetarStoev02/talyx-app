import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useOffice } from '@app/providers/useOffice'
import { BotCard } from '@features/bot-card/BotCard'
import { EventFeed } from '@widgets/event-feed/EventFeed'
import { TopBar } from '@widgets/office-hud/TopBar'
import { OfficeScene } from '@widgets/office-scene'
import { RosterPanel } from '@widgets/roster-panel/RosterPanel'

export function OfficePage(): React.JSX.Element {
  const { snapshot, selectedBotId, load, select, subscribe } = useOffice()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = subscribe()
    load(null).catch((err: unknown) =>
      setError(err instanceof Error ? err.message : 'Could not load the office')
    )
    return unsubscribe
  }, [load, subscribe])

  async function handleSwitchProject(projectId: string): Promise<void> {
    try {
      select(null)
      await window.api.updateSettings({ currentProjectId: projectId })
      await load(projectId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not switch project')
    }
  }

  const selected = snapshot?.bots.find((b) => b.id === selectedBotId) ?? null

  return (
    <div className="relative h-screen w-screen bg-black font-sans text-white">
      {snapshot ? (
        <>
          <OfficeScene snapshot={snapshot} selectedBotId={selectedBotId} onSelect={select} />
          <TopBar snapshot={snapshot} onSwitchProject={handleSwitchProject} />
          <RosterPanel snapshot={snapshot} selectedBotId={selectedBotId} onSelect={select} />
          <EventFeed snapshot={snapshot} />
          {selected && (
            <BotCard
              key={selected.id}
              bot={selected}
              roomName={snapshot.rooms.find((r) => r.id === selected.placement.roomId)?.name ?? ''}
              t3Projects={snapshot.t3Projects}
              onClose={() => select(null)}
            />
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
