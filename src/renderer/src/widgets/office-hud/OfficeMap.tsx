import { useEffect } from 'react'
import type { OfficeSnapshot } from '../../../../shared/office'

interface OfficeMapProps {
  snapshot: OfficeSnapshot
  onPick: (projectId: string) => void
  onClose: () => void
}

export function OfficeMap({ snapshot, onPick, onClose }: OfficeMapProps): React.JSX.Element {
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="absolute inset-0 z-30 flex items-start justify-center bg-black/60 pt-24"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Projects"
        className="w-[520px] rounded-lg border border-[#2e2e2e] bg-[#111] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-xs font-medium text-[#949494]">Projects</h2>
        <div className="grid grid-cols-3 gap-2">
          {snapshot.projects.map((project) => {
            const current = project.id === snapshot.project.id
            return (
              <button
                key={project.id}
                type="button"
                onClick={() => onPick(project.id)}
                aria-current={current}
                className={`flex flex-col items-start gap-2 rounded-md border p-3 text-left hover:border-[#b4b4b4] focus-visible:outline-2 focus-visible:outline-white ${current ? 'border-white' : 'border-[#444]'}`}
              >
                {project.logoDataUrl ? (
                  <img
                    src={project.logoDataUrl}
                    alt=""
                    className="size-8 rounded-md object-contain"
                  />
                ) : (
                  <span className="flex size-8 items-center justify-center rounded-md bg-white font-semibold text-black">
                    {project.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="text-sm">{project.name}</span>
                {current && (
                  <span className="text-xs text-[#949494]">
                    {snapshot.bots.length} {snapshot.bots.length === 1 ? 'bot' : 'bots'}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
