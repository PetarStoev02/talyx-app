import { useId, useMemo, useState } from 'react'
import type { UiComponent, UiSurface } from '@contract/a2uiSurface'
import { pathKey, resolveText } from '@contract/a2uiSurface'
import { surfaceAnswer, surfaceClickMessage } from '@features/chat/surfaceMessage'
import type { ChatItem } from '@features/chat/types'
import { useLanguage } from '@shared/lib/i18n'
import { Button } from '@shared/ui/button'
import { Input, NativeSelect } from '@shared/ui/input'
import { cn } from '@shared/lib/utils'
import { SurfaceChart } from './SurfaceChart'

type Values = Record<string, string | string[]>
type Choice = Extract<UiComponent, { component: 'ChoicePicker' }>

// Up to this many options show as pills, all in view; more fold into a dropdown.
const PILL_OPTIONS = 4
const PILL = 'h-auto rounded-full border px-4 py-2 text-sm font-medium'
const PICKED = 'border-brand bg-brand/15 hover:bg-brand/15 disabled:opacity-100'
const SHARE_BAR_MIN = 'min-w-20'
const SHARE_BAR_HEIGHT = 'h-1.5'

/** What every part of a surface draws with: its components, the inputs' values, and its state. */
interface Drawing {
  byId: Map<string, UiComponent>
  values: Values
  setValues: (next: Values) => void
  answered: boolean
  picked: string | null
  onButton: (buttonId: string) => void
}

/**
 * An interface a bot put in its answer. A click sends your next message; once you have answered,
 * it stays as a record of what was asked and what you picked.
 */
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
  const { answered, pickedButtonId: picked, values: sent } = surfaceAnswer(items, item)
  const [typed, setValues] = useState<Values>({ ...surface.dataModel })
  // An answered form is a record: it shows what was sent, also after the chat was reopened.
  const values = sent ?? typed
  const byId = useMemo(
    () => new Map(surface.components.map((component) => [component.id, component])),
    [surface.components]
  )
  const root = byId.get('root')
  if (!root) return null
  const drawing: Drawing = {
    byId,
    values,
    setValues,
    answered,
    picked,
    onButton: (buttonId) => onSend(surfaceClickMessage(surface, buttonId, values))
  }
  const pickedButton = picked ? byId.get(picked) : undefined
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="w-full rounded-3xl border border-border bg-card p-5">
        <Part component={root} drawing={drawing} />
      </div>
      {pickedButton?.component === 'Button' && (
        <p className="flex items-center gap-1.5 px-1 text-sm text-muted-foreground">
          <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
          {t('chat.surfacePicked').replace('{choice}', labelOf(pickedButton, drawing))}
        </p>
      )}
    </div>
  )
}

function Part({
  component,
  drawing
}: {
  component: UiComponent
  drawing: Drawing
}): React.JSX.Element | null {
  switch (component.component) {
    case 'Column':
      return <Column parts={partsOf(component.children, drawing)} drawing={drawing} />
    case 'Row':
      return <Row parts={partsOf(component.children, drawing)} drawing={drawing} />
    case 'Divider':
      return <hr className="border-border" />
    case 'Text':
      return (
        <p
          className={cn(
            'text-base',
            component.variant === 'heading' && 'font-semibold',
            component.variant === 'caption' && 'text-sm text-muted-foreground'
          )}
        >
          {resolveText(component.text, drawing.values)}
        </p>
      )
    case 'Stat':
      return (
        <div className="rounded-2xl bg-secondary px-3.5 py-3">
          <span className="block text-xl font-semibold tabular-nums">{component.value}</span>
          <span className="text-sm text-muted-foreground">
            {component.label}
            {component.note && (
              <span
                className={cn(
                  'ml-1.5',
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
    case 'Chart':
      return <SurfaceChart chart={component} />
    case 'Table':
      return <Table table={component} />
    case 'Button': {
      const picked = drawing.picked === component.id
      return (
        <Button
          type="button"
          variant={component.variant === 'primary' && !drawing.answered ? 'default' : 'secondary'}
          disabled={drawing.answered}
          aria-pressed={drawing.answered ? picked : undefined}
          className={cn(
            PILL,
            component.variant === 'primary' && !drawing.answered
              ? 'border-primary'
              : 'border-border bg-card hover:bg-secondary',
            picked && PICKED
          )}
          onClick={() => drawing.onButton(component.id)}
        >
          {labelOf(component, drawing)}
        </Button>
      )
    }
    case 'ChoicePicker':
      return <ChoiceField choice={component} drawing={drawing} />
    case 'TextField': {
      const key = pathKey(component.value)
      const value = drawing.values[key]
      return (
        <label className="block text-sm text-muted-foreground">
          {component.label}
          <Input
            className="rounded-xl text-foreground"
            disabled={drawing.answered}
            placeholder={component.placeholder ?? ''}
            value={typeof value === 'string' ? value : ''}
            onChange={(event) =>
              drawing.setValues({ ...drawing.values, [key]: event.target.value })
            }
          />
        </label>
      )
    }
  }
}

function Column({ parts, drawing }: { parts: UiComponent[]; drawing: Drawing }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      {parts.map((part, index) => (
        // A caption under a heading reads as one title, so it sits close to it.
        <div key={part.id} className={cn(isSubtitle(part, parts[index - 1]) && '-mt-3')}>
          <Part component={part} drawing={drawing} />
        </div>
      ))}
    </div>
  )
}

function Row({ parts, drawing }: { parts: UiComponent[]; drawing: Drawing }): React.JSX.Element {
  const body = parts.map((part) => <Part key={part.id} component={part} drawing={drawing} />)
  // Number tiles share the width evenly; inputs sit side by side; anything else wraps as it comes.
  if (parts.every((part) => part.component === 'Stat'))
    return (
      <div className="grid grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] gap-2.5">{body}</div>
    )
  if (parts.every((part) => part.component === 'TextField' || part.component === 'ChoicePicker'))
    return <div className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-3">{body}</div>
  return <div className="flex flex-wrap items-center gap-2">{body}</div>
}

function ShareBar({ percent }: { percent: number }): React.JSX.Element {
  return (
    <div
      role="img"
      aria-label={`${Math.round(percent)}%`}
      className={cn('w-full rounded-full bg-brand/20', SHARE_BAR_MIN, SHARE_BAR_HEIGHT)}
    >
      <div
        className={cn('h-full rounded-full bg-brand', SHARE_BAR_HEIGHT)}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

function Table({
  table
}: {
  table: Extract<UiComponent, { component: 'Table' }>
}): React.JSX.Element {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr>
          {table.columns.map((column, index) => (
            <th
              key={index}
              scope="col"
              className={cn(
                'pb-2 text-left font-medium text-muted-foreground',
                column.align === 'right' && 'text-right'
              )}
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) => (
              <td
                key={cellIndex}
                className={cn(
                  'border-t border-border py-2.5 tabular-nums',
                  table.columns[cellIndex]?.align === 'right' && 'text-right'
                )}
              >
                {table.columns[cellIndex]?.kind === 'bar' && typeof cell === 'number' ? (
                  <ShareBar percent={cell} />
                ) : (
                  cell
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ChoiceField({ choice, drawing }: { choice: Choice; drawing: Drawing }): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const labelId = useId()
  const key = pathKey(choice.value)
  const raw = drawing.values[key]
  const chosen = Array.isArray(raw) ? raw : raw ? [raw] : []
  const pick = (value: string): void => {
    const many = chosen.includes(value)
      ? chosen.filter((item) => item !== value)
      : [...chosen, value]
    drawing.setValues({ ...drawing.values, [key]: choice.multiple ? many : value })
  }
  if (!choice.multiple && choice.options.length > PILL_OPTIONS)
    return (
      <label className="block text-sm text-muted-foreground">
        {choice.label}
        <NativeSelect
          className="rounded-xl text-foreground"
          disabled={drawing.answered}
          value={typeof raw === 'string' ? raw : ''}
          onChange={(event) => pick(event.target.value)}
        >
          <option value="">{t('chat.surfaceChoose')}</option>
          {choice.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      </label>
    )
  return (
    <div
      role={choice.multiple ? 'group' : 'radiogroup'}
      aria-labelledby={choice.label ? labelId : undefined}
      className="flex flex-col gap-1.5"
    >
      {choice.label && (
        <span id={labelId} className="text-sm text-muted-foreground">
          {choice.label}
        </span>
      )}
      <div className="flex flex-wrap gap-2">
        {choice.options.map((option) => {
          const on = chosen.includes(option.value)
          return (
            <Button
              key={option.value}
              type="button"
              variant="secondary"
              role={choice.multiple ? 'checkbox' : 'radio'}
              aria-checked={on}
              disabled={drawing.answered}
              className={cn(PILL, 'border-border bg-card hover:bg-secondary', on && PICKED)}
              onClick={() => pick(option.value)}
            >
              {option.label}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

function partsOf(ids: string[], drawing: Drawing): UiComponent[] {
  return ids.flatMap((id) => {
    const part = drawing.byId.get(id)
    return part ? [part] : []
  })
}

function isSubtitle(part: UiComponent, before: UiComponent | undefined): boolean {
  return (
    part.component === 'Text' &&
    part.variant === 'caption' &&
    before?.component === 'Text' &&
    before.variant === 'heading'
  )
}

function labelOf(button: Extract<UiComponent, { component: 'Button' }>, drawing: Drawing): string {
  const label = drawing.byId.get(button.child)
  return label?.component === 'Text' ? resolveText(label.text, drawing.values) : ''
}
