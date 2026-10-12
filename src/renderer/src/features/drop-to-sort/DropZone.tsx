import { useState, useCallback, useRef } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@shared/lib/utils'
import { folderApi } from '@shared/api/ipc'
import { useLanguage } from '@app/providers/useLanguage'

export interface DropResult {
  folders: string[]
  files: string[]
}

interface DropZoneProps {
  onDrop: (result: DropResult) => void
  disabled?: boolean
  children: React.ReactNode
}

export function DropZone({ onDrop, disabled, children }: DropZoneProps): React.JSX.Element {
  const [dragging, setDragging] = useState(false)
  const dragCounter = useRef(0)
  const t = useLanguage((s) => s.t)

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounter.current++
      if (!disabled) setDragging(true)
    },
    [disabled]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) setDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragging(false)
      dragCounter.current = 0

      if (disabled) return

      const droppedFiles = Array.from(e.dataTransfer.files)
      if (droppedFiles.length === 0) return

      const paths = droppedFiles.map((file) => folderApi.pathForFile(file)).filter(Boolean)
      if (paths.length === 0) return

      // The filesystem decides what's a folder — the drop event only carries names
      folderApi.classifyPaths(paths).then(({ folders, files }) => {
        if (folders.length > 0 || files.length > 0) {
          onDrop({ folders, files })
        }
      })
    },
    [disabled, onDrop]
  )

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative h-full"
    >
      {children}

      {dragging && (
        <div
          className={cn(
            'absolute inset-0 z-10 flex flex-col items-center justify-center gap-2',
            'rounded-xl border-2 border-dashed border-foreground/50 bg-foreground/5',
            'backdrop-blur-[2px] animate-in fade-in duration-150'
          )}
        >
          <Upload className="h-6 w-6 text-foreground/70" />
          <p className="text-sm font-medium text-foreground/70">{t('sort.dropFoldersOrFiles')}</p>
        </div>
      )}
    </div>
  )
}
