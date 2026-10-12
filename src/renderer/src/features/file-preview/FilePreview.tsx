export interface FilePreviewData {
  type: 'image' | 'text' | 'metadata'
  content: string
}

export interface FilePreviewInfo {
  fileName: string
  filePath: string
  category: string
  subcategory: string | null
}

interface FilePreviewProps {
  preview: FilePreviewData | null
  file: FilePreviewInfo | null
}

export function FilePreview({ preview, file }: FilePreviewProps): React.JSX.Element | null {
  if (!preview || !file) return null

  const ext = file.fileName.split('.').pop()?.toUpperCase() ?? ''
  const dir = file.filePath.replace(file.fileName, '').replace(/[/\\]$/, '')

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Preview content */}
      {preview.type === 'image' && (
        <div className="flex items-center justify-center bg-muted/30 p-4">
          <img
            src={preview.content}
            alt={file.fileName}
            className="max-h-[240px] max-w-full rounded object-contain"
          />
        </div>
      )}

      {preview.type === 'text' && (
        <div className="max-h-[240px] overflow-auto bg-muted/20 p-3">
          <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-foreground/70">
            {preview.content}
          </pre>
        </div>
      )}

      {/* Information table */}
      <div className="flex-1 p-3">
        <h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Information
        </h3>
        <div className="space-y-1.5">
          <InfoRow label="Name" value={file.fileName} />
          <InfoRow label="Type" value={ext} />
          <InfoRow label="Category" value={file.category} />
          {file.subcategory && <InfoRow label="Subcategory" value={file.subcategory} />}
          <InfoRow label="Location" value={dir} mono />
        </div>
      </div>
    </div>
  )
}

function InfoRow({
  label,
  value,
  mono
}: {
  label: string
  value: string
  mono?: boolean
}): React.JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <span
        className={`truncate text-right text-[11px] text-foreground ${mono ? 'font-mono' : ''}`}
      >
        {value}
      </span>
    </div>
  )
}
