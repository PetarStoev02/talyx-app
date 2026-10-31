import { useState } from 'react'
import { TalyxLogo } from '@shared/ui/TalyxLogo'
import type { OfficeSnapshot } from '../../../../shared/office'
import { OfficeMap } from './OfficeMap'
import { roomCounts } from './roomCounts'

interface TopBarProps {
  snapshot: OfficeSnapshot
  onSwitchProject: (projectId: string) => void
}

export function TopBar({ snapshot, onSwitchProject }: TopBarProps): React.JSX.Element {
  const [mapOpen, setMapOpen] = useState(false)

  function handlePick(projectId: string): void {
    setMapOpen(false)
    if (projectId !== snapshot.project.id) onSwitchProject(projectId)
  }

  return (
    <>
      <header className="absolute top-4 left-5 z-10 flex items-center">
        <div className="flex items-center gap-2.5 pr-5 text-base font-semibold">
          <TalyxLogo size={22} />
          <span>Talyx</span>
          <button
            type="button"
            onClick={() => setMapOpen(true)}
            aria-haspopup="dialog"
            aria-label={`Project ${snapshot.project.name}, switch project`}
            className="rounded-md px-1.5 font-medium text-[#b4b4b4] hover:text-white focus-visible:outline-2 focus-visible:outline-white"
          >
            {snapshot.project.name}
          </button>
        </div>
        {roomCounts(snapshot).map((room) => (
          <div key={room.roomId} className="border-l border-[#2e2e2e] px-5">
            <span className="block text-xl leading-6 font-semibold tabular-nums">{room.count}</span>
            <span className="text-xs text-[#949494]">{room.name}</span>
          </div>
        ))}
      </header>
      {mapOpen && (
        <OfficeMap snapshot={snapshot} onPick={handlePick} onClose={() => setMapOpen(false)} />
      )}
    </>
  )
}
