import { useEffect, useRef } from 'react'
import type { OfficeSnapshot } from '../../../../shared/office'
import { OfficeWorld } from './scene/OfficeWorld'

interface OfficeSceneProps {
  snapshot: OfficeSnapshot
  selectedBotId: string | null
  onSelect: (botId: string) => void
}

export function OfficeScene({
  snapshot,
  selectedBotId,
  onSelect
}: OfficeSceneProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<OfficeWorld | null>(null)
  const onSelectRef = useRef(onSelect)

  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  useEffect(() => {
    const world = new OfficeWorld(containerRef.current!, (id) => onSelectRef.current(id))
    worldRef.current = world
    return () => {
      world.dispose()
      worldRef.current = null
    }
  }, [])

  useEffect(() => {
    worldRef.current?.apply(snapshot)
  }, [snapshot])

  useEffect(() => {
    worldRef.current?.select(selectedBotId)
  }, [selectedBotId])

  return <div ref={containerRef} className="relative h-full w-full overflow-hidden" />
}
