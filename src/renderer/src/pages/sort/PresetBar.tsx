import { useEffect, useState } from 'react'
import { Bookmark, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useLanguage } from '@app/providers/useLanguage'
import type { SortPreset } from '@shared/api/ipc'

interface PresetBarProps {
  presets: SortPreset[]
  disabled: boolean
  onLoad: (preset: SortPreset) => void
  onRename: (index: number, name: string) => void
  onDelete: (index: number) => void
}

export function PresetBar({
  presets,
  disabled,
  onLoad,
  onRename,
  onDelete
}: PresetBarProps): React.JSX.Element | null {
  const t = useLanguage((s) => s.t)
  const [editingPreset, setEditingPreset] = useState<number | null>(null)
  const [editPresetName, setEditPresetName] = useState('')
  const [presetMenuOpen, setPresetMenuOpen] = useState<number | null>(null)

  // Close preset menu on outside click
  useEffect(() => {
    if (presetMenuOpen === null) return
    const handler = (): void => setPresetMenuOpen(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [presetMenuOpen])

  if (presets.length === 0) return null

  function commitRename(index: number): void {
    if (!editPresetName.trim()) return
    onRename(index, editPresetName.trim())
    setEditingPreset(null)
    setEditPresetName('')
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Bookmark className="h-4 w-4 text-muted-foreground shrink-0" />
      {presets.map((preset, i) => (
        <div key={i} className="relative group inline-flex items-center">
          {editingPreset === i ? (
            <input
              type="text"
              value={editPresetName}
              onChange={(e) => setEditPresetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename(i)
                if (e.key === 'Escape') setEditingPreset(null)
              }}
              onBlur={() => {
                if (!editPresetName.trim()) {
                  setEditingPreset(null)
                } else {
                  commitRename(i)
                }
              }}
              className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground w-32"
              autoFocus
            />
          ) : (
            <button
              onClick={() => onLoad(preset)}
              disabled={disabled}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent transition-colors"
            >
              {preset.name}
            </button>
          )}
          {editingPreset !== i && (
            <div className="relative">
              <button
                onClick={() => setPresetMenuOpen(presetMenuOpen === i ? null : i)}
                className="ml-0.5 rounded p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-foreground transition-all"
              >
                <MoreHorizontal className="h-3 w-3" />
              </button>
              {presetMenuOpen === i && (
                <div className="absolute top-full right-0 z-10 mt-1 w-28 rounded-md border border-border bg-background shadow-md py-1">
                  <button
                    onClick={() => {
                      setEditPresetName(preset.name)
                      setEditingPreset(i)
                      setPresetMenuOpen(null)
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                    {t('sort.rename')}
                  </button>
                  <button
                    onClick={() => {
                      setPresetMenuOpen(null)
                      onDelete(i)
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-accent transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    {t('common.delete')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
