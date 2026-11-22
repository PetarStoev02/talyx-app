import { useMemo, useState } from 'react'
import type { UiComponent, UiSurface } from '@contract/a2uiSurface'
import { pathKey, resolveText } from '@contract/a2uiSurface'
import { surfaceAnswer, surfaceClickMessage } from '@features/chat/surfaceMessage'
import type { ChatItem } from '@features/chat/types'
import { useLanguage } from '@shared/lib/i18n'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { cn } from '@shared/lib/utils'
import { SurfaceChart } from './SurfaceChart'

export function SurfaceCard({
  id,
  surface,
  items,
  onSend
}: {
  id: string
  surface: UiSurface
  items: ChatItem[]
  onSend: (text: string) => void
}): React.JSX.Element | null {
  const t = useLanguage((s) => s.t)
  const item = useMemo(
    () => ({ kind: 'surface' as const, id, surface, toolCallId: id }),
    [id, surface]
  )
  const { answered, pickedButtonId } = surfaceAnswer(items, item)
  const [model, setModel] = useState<Record<string, string | string[]>>({ ...surface.dataModel })
  const byId = useMemo(
    () => new Map(surface.components.map((component) => [component.id, component])),
    [surface.components]
  )
  const root = byId.get('root')
  if (!root) return null
  return (
    <div className="flex w-full flex-col gap-2">
      <LinkingCard>
        <SurfaceNode
          component={root}
          byId={byId}
          dataModel={model}
          setModel={setModel}
          disabled={answered}
          pickedButtonId={pickedButtonId}
          onButton={(buttonId) => {
            if (answered) return
            onSend(surfaceClickMessage(surface, buttonId, model))
          }}
        />
      </LinkingCard>
      {answered && pickedButtonId && (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
          {t('chat.surfacePicked').replace(
            '{choice}',
            buttonText(surface, byId.get(pickedButtonId) as UiComponent)
          )}
        </p>
      )}
    </div>
  )
}

function LinkingCard({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="w-full rounded-[20px] border border-border bg-card p-[18px]">
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  )
}

function SurfaceNode({
  component,
  byId,
  dataModel,
  setModel,
  disabled,
  pickedButtonId,
  onButton
}: {
  component: UiComponent
  byId: Map<string, UiComponent>
  dataModel: Record<string, string | string[]>
  setModel: (next: Record<string, string | string[]>) => void
  disabled: boolean
  pickedButtonId: string | null
  onButton: (buttonId: string) => void
}): React.JSX.Element | null {
  switch (component.component) {
    case 'Column': {
      const nodes = component.children
        .map((child) => byId.get(child))
        .filter((node): node is UiComponent => node !== undefined)
      const statsOnly = nodes.length > 0 && nodes.every((node) => node.component === 'Stat')
      const body = nodes.map((node) => (
        <SurfaceNode
          key={node.id}
          component={node}
          byId={byId}
          dataModel={dataModel}
          setModel={setModel}
          disabled={disabled}
          pickedButtonId={pickedButtonId}
          onButton={onButton}
        />
      ))
      return statsOnly ? (
        <div className="grid grid-cols-3 gap-2.5">{body}</div>
      ) : (
        <div className="flex flex-col gap-4">{body}</div>
      )
    }
    case 'Row':
      return (
        <div className="flex flex-wrap gap-2">
          {component.children.map((child) => {
            const node = byId.get(child)
            return node ? (
              <SurfaceNode
                key={child}
                component={node}
                byId={byId}
                dataModel={dataModel}
                setModel={setModel}
                disabled={disabled}
                pickedButtonId={pickedButtonId}
                onButton={onButton}
              />
            ) : null
          })}
        </div>
      )
    case 'Divider':
      return <hr className="border-border" />
    case 'Text':
      return (
        <p
          className={cn(
            component.variant === 'heading' && 'text-[15px] font-semibold',
            component.variant === 'caption' && 'text-sm text-muted-foreground',
            (!component.variant || component.variant === 'body') && 'text-[15px]'
          )}
        >
          {resolveText(component.text, dataModel)}
        </p>
      )
    case 'Stat':
      return (
        <div className="rounded-[14px] bg-secondary px-3 py-2.5">
          <span className="block text-xl font-semibold tabular-nums">{component.value}</span>
          <span className="text-xs text-muted-foreground">
            {component.label}
            {component.note && (
              <span
                className={cn(
                  'ml-1',
                  component.tone === 'up' && 'text-success',
                  component.tone === 'down' && 'text-destructive-text'
                )}
              >
                {component.note}
              </span>
            )}
          </span>
        </div>
      )
    case 'Chart': {
      const summary = `${component.kind} chart, ${component.labels.length} points`
      return <SurfaceChart chart={component} summary={summary} />
    }
    case 'Table':
      return (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {component.columns.map((column) => (
                <th
                  key={column.label}
                  className={cn(
                    'pb-1.5 text-left text-xs font-medium text-muted-foreground',
                    column.align === 'right' && 'text-right'
                  )}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {component.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={cn(
                      'border-t border-border py-2 tabular-nums',
                      component.columns[cellIndex]?.align === 'right' && 'text-right'
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )
    case 'Button': {
      const label = byId.get(component.child)
      const text = label?.component === 'Text' ? resolveText(label.text, dataModel) : ''
      const picked = pickedButtonId === component.id
      return (
        <Button
          type="button"
          variant={component.variant === 'primary' ? 'default' : 'secondary'}
          disabled={disabled}
          className={cn('rounded-full px-4 py-2', picked && 'border-brand bg-brand/15')}
          onClick={() => onButton(component.id)}
        >
          {text}
        </Button>
      )
    }
    case 'ChoicePicker': {
      const key = pathKey(component.value)
      const raw = dataModel[key]
      const selected = component.multiple
        ? new Set(Array.isArray(raw) ? raw : [])
        : new Set(typeof raw === 'string' && raw ? [raw] : [])
      return (
        <label className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          {component.label}
          {component.multiple ? (
            <div className="flex flex-wrap gap-2">
              {component.options.map((option) => {
                const on = selected.has(option.value)
                return (
                  <Button
                    key={option.value}
                    type="button"
                    variant="secondary"
                    disabled={disabled}
                    className={cn('rounded-full', on && 'border-brand bg-brand/15')}
                    onClick={() => {
                      const next = new Set(selected)
                      if (on) next.delete(option.value)
                      else next.add(option.value)
                      setModel({ ...dataModel, [key]: [...next] })
                    }}
                  >
                    {option.label}
                  </Button>
                )
              })}
            </div>
          ) : (
            <select
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
              disabled={disabled}
              value={typeof raw === 'string' ? raw : ''}
              onChange={(event) => setModel({ ...dataModel, [key]: event.target.value })}
            >
              <option value="">{component.label ?? 'Choose'}</option>
              {component.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
        </label>
      )
    }
    case 'TextField': {
      const key = pathKey(component.value)
      return (
        <label className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          {component.label}
          <Input
            className="rounded-xl"
            disabled={disabled}
            placeholder={component.placeholder ?? ''}
            value={typeof dataModel[key] === 'string' ? dataModel[key] : ''}
            onChange={(event) => setModel({ ...dataModel, [key]: event.target.value })}
          />
        </label>
      )
    }
    default:
      return null
  }
}

function buttonText(surface: UiSurface, component: UiComponent | undefined): string {
  if (component?.component !== 'Button') return ''
  const label = surface.components.find((item) => item.id === component.child)
  if (label?.component !== 'Text') return ''
  return resolveText(label.text, surface.dataModel)
}
