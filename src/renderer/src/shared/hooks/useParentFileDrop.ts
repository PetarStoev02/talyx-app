import { useEffect, useEffectEvent } from 'react'

/**
 * Takes files dropped anywhere on the parent of the element `child` holds, from the first render
 * on. Only a drag of files is taken: selected text or a link still drops where it would.
 * `onDrop` always sees the latest props.
 */
export function useParentFileDrop(
  child: React.RefObject<HTMLElement | null>,
  onDrop: (files: FileList) => void
): void {
  const dropped = useEffectEvent(onDrop)
  useEffect(() => {
    const area = child.current?.parentElement
    if (!area) return
    const over = (event: DragEvent): void => {
      if (!event.dataTransfer?.types.includes('Files')) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    }
    const drop = (event: DragEvent): void => {
      if (!event.dataTransfer?.types.includes('Files')) return
      event.preventDefault()
      dropped(event.dataTransfer.files)
    }
    area.addEventListener('dragover', over)
    area.addEventListener('drop', drop)
    return () => {
      area.removeEventListener('dragover', over)
      area.removeEventListener('drop', drop)
    }
  }, [child])
}
