import { useEffect, useState } from 'react'
import { useOffice } from '@app/providers/useOffice'
import { OfficeScene } from '@widgets/office-scene'

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

  return (
    <div className="h-screen w-screen bg-black font-sans text-white">
      {snapshot ? (
        <OfficeScene snapshot={snapshot} selectedBotId={selectedBotId} onSelect={select} />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-[#949494]">
          {error ?? 'Talyx'}
        </div>
      )}
    </div>
  )
}
