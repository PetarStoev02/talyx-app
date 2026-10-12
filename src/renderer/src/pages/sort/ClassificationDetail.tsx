import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { Button } from '@shared/ui/button'
import { cn, formatBytes } from '@shared/lib/utils'
import { getCategoryChartBg } from '@shared/lib/categoryChart'
import { TAXONOMY } from '@shared/lib/taxonomy'
import { useLanguage } from '@app/providers/useLanguage'
import type { ClassifiedFile, ExtractedEntities } from '@shared/api/ipc'

interface ClassificationDetailProps {
  file: ClassifiedFile
  onCorrect: (params: { filePath: string; category: string; subcategory: string | null }) => void
}

const ENTITY_LABEL_KEYS = {
  dates: 'sort.entityDates',
  names: 'sort.entityNames',
  amounts: 'sort.entityAmounts',
  organizations: 'sort.entityOrganizations',
  locations: 'sort.entityLocations'
} as const

/**
 * Detail pane for the selected preview file: classification path, confidence,
 * suggested rename, extracted entities, and the inline category correction
 * that replaced the old CorrectionDialog modal.
 */
export function ClassificationDetail({
  file,
  onCorrect
}: ClassificationDetailProps): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const tc = useLanguage((s) => s.tc)
  const c = file.classification
  const [category, setCategory] = useState(c.category)
  const [subcategory, setSubcategory] = useState<string | null>(c.subcategory ?? null)
  const subOptions = TAXONOMY[category] ?? []

  const pathText =
    c.semanticPath && c.semanticPath.length > 0
      ? c.semanticPath.map(tc).join(' / ')
      : [tc(c.category), c.subcategory ? tc(c.subcategory) : null].filter(Boolean).join(' / ')

  const entityGroups = (Object.keys(ENTITY_LABEL_KEYS) as Array<keyof ExtractedEntities>).filter(
    (key) => (c.entities?.[key]?.length ?? 0) > 0
  )

  return (
    <div className="h-full overflow-auto p-4">
      <p className="truncate text-sm font-medium text-foreground" title={file.name}>
        {file.name}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{formatBytes(file.size)}</p>

      <div className="mt-4 space-y-3">
        <DetailField label={t('sort.classification')}>
          <span className="flex items-center gap-1.5 min-w-0">
            <span className={cn('h-2 w-2 rounded-full shrink-0', getCategoryChartBg(c.category))} />
            <span className="truncate text-[13px] text-foreground">{pathText}</span>
          </span>
        </DetailField>

        <DetailField label={t('sort.confidence')}>
          <span className="flex items-center gap-1.5">
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                c.confidence >= 0.85
                  ? 'bg-foreground/80'
                  : c.confidence >= 0.7
                    ? 'bg-muted-foreground/50'
                    : 'bg-warning/80'
              )}
            />
            <span className="text-[13px] tabular-nums text-foreground">
              {Math.round(c.confidence * 100)}%
            </span>
          </span>
        </DetailField>

        {c.suggestedName && (
          <DetailField label={t('sort.suggestedRename')}>
            <span className="flex items-center gap-1.5 min-w-0">
              <Pencil className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="truncate text-[13px] text-foreground" title={c.suggestedName}>
                {c.suggestedName}
              </span>
            </span>
          </DetailField>
        )}

        {entityGroups.length > 0 && (
          <DetailField label={t('sort.entities')}>
            <div className="space-y-1.5">
              {entityGroups.map((key) => (
                <div key={key} className="flex flex-wrap items-center gap-1">
                  <span className="text-[11px] text-muted-foreground">
                    {t(ENTITY_LABEL_KEYS[key])}:
                  </span>
                  {c.entities![key].map((value) => (
                    <span
                      key={value}
                      className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-foreground"
                    >
                      {value}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </DetailField>
        )}
      </div>

      {/* Inline correction — replaces the old CorrectionDialog modal */}
      <div className="mt-5 border-t border-border pt-4">
        <h3 className="text-xs font-medium text-foreground">{t('sort.correctCategory')}</h3>

        <label className="mt-3 mb-1 block text-xs font-medium text-muted-foreground">
          {t('sort.category')}
        </label>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value)
            setSubcategory(null)
          }}
          className="mb-3 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground"
        >
          {Object.keys(TAXONOMY).map((cat) => (
            <option key={cat} value={cat}>
              {tc(cat)}
            </option>
          ))}
        </select>

        {subOptions.length > 0 && (
          <>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t('sort.subcategory')}
            </label>
            <select
              value={subcategory ?? ''}
              onChange={(e) => setSubcategory(e.target.value || null)}
              className="mb-3 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground"
            >
              <option value="">—</option>
              {subOptions.map((sub) => (
                <option key={sub} value={sub}>
                  {tc(sub)}
                </option>
              ))}
            </select>
          </>
        )}

        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            onClick={() => onCorrect({ filePath: file.path, category, subcategory })}
          >
            {t('common.save')}
          </Button>
        </div>
      </div>
    </div>
  )
}

function DetailField({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div>
      <p className="mb-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  )
}
