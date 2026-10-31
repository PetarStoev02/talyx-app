import { useEffect, useState } from 'react'
import type { OfficeSnapshot } from '../../../../shared/office'

type SnapshotBot = OfficeSnapshot['bots'][number]

interface RosterPanelProps {
  snapshot: OfficeSnapshot
  selectedBotId: string | null
  onSelect: (botId: string) => void
}

const MINUTE_MS = 60_000

export function RosterPanel({
  snapshot,
  selectedBotId,
  onSelect
}: RosterPanelProps): React.JSX.Element {
  const now = useMinuteClock()
  const roomNames = new Map(snapshot.rooms.map((r) => [r.id, r.name]))

  return (
    <aside
      aria-label="Crew"
      className="absolute top-[84px] right-4 z-10 max-h-[calc(100vh-100px)] w-[248px] overflow-auto rounded-lg border border-[#2e2e2e] bg-[#111] p-2"
    >
      {sections(snapshot).map((section) => (
        <section key={section.id}>
          <h4 className="mx-2 mt-2 mb-1 text-xs font-medium text-[#949494]">{section.name}</h4>
          {section.bots.map((bot) => (
            <button
              key={bot.id}
              type="button"
              onClick={() => onSelect(bot.id)}
              aria-pressed={bot.id === selectedBotId}
              className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-[#1c1c1c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${bot.id === selectedBotId ? 'bg-[#1c1c1c]' : ''}`}
            >
              <span
                aria-hidden
                className="h-4 w-5 shrink-0 rounded-full"
                style={{ background: bot.color }}
              />
              <span className="min-w-0 flex-1 text-[13px]">
                {bot.name}
                <span className="block truncate text-xs leading-4 text-[#949494]">
                  {status(bot, now)}
                </span>
              </span>
              <span className="text-[11px] whitespace-nowrap text-[#b4b4b4]">
                {(roomNames.get(bot.placement.roomId) ?? '').split(' ')[0]}
              </span>
            </button>
          ))}
        </section>
      ))}
    </aside>
  )
}

function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), MINUTE_MS)
    return () => clearInterval(id)
  }, [])
  return now
}

// A bot in several groups is listed under its first group that exists.
function sections(snapshot: OfficeSnapshot): { id: string; name: string; bots: SnapshotBot[] }[] {
  const groupIds = new Set(snapshot.groups.map((g) => g.id))
  const home = (bot: SnapshotBot): string | null =>
    bot.groupIds.find((id) => groupIds.has(id)) ?? null
  const grouped = snapshot.groups.map((g) => ({
    id: g.id,
    name: g.name,
    bots: snapshot.bots.filter((b) => home(b) === g.id)
  }))
  const loose = snapshot.bots.filter((b) => home(b) === null)
  return [...grouped, { id: 'ungrouped', name: 'Ungrouped', bots: loose }].filter(
    (s) => s.bots.length > 0
  )
}

function status(bot: SnapshotBot, now: number): string {
  const { stale, lastSeenAt, task } = bot.placement
  if (stale && lastSeenAt) {
    const minutes = Math.max(0, Math.floor((now - Date.parse(lastSeenAt)) / MINUTE_MS))
    return `last seen ${minutes} min ago`
  }
  return task ?? 'Idle'
}
