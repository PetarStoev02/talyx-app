import type { UiComponent, UiSurface } from '@contract/a2uiSurface'
import { pathKey, resolveText } from '@contract/a2uiSurface'
import type { ChatItem } from './types'

type SurfaceItem = Extract<ChatItem, { kind: 'surface' }>

export type SurfaceAnswer = {
  answered: boolean
  pickedButtonId: string | null
}

/** Whether a user message after this surface has answered it, and which button label matched. */
export function surfaceAnswer(items: ChatItem[], surface: SurfaceItem): SurfaceAnswer {
  const at = items.findIndex((item) => item.id === surface.id)
  if (at < 0) return { answered: false, pickedButtonId: null }
  const next = items.slice(at + 1).find((item) => item.kind === 'user')
  if (!next || next.kind !== 'user') return { answered: false, pickedButtonId: null }
  const firstLine = next.text.split('\n')[0] ?? ''
  const picked = buttonsOf(surface.surface).find(
    (button) => buttonLabel(surface.surface, button) === firstLine
  )
  return { answered: true, pickedButtonId: picked?.id ?? null }
}

/** Text the user sends when they click a button on a surface. */
export function surfaceClickMessage(
  surface: UiSurface,
  buttonId: string,
  dataModel: Record<string, string | string[]>
): string {
  const byId = new Map(surface.components.map((component) => [component.id, component]))
  const button = byId.get(buttonId)
  if (button?.component !== 'Button') return ''
  const label = buttonLabel(surface, button)
  const fields = inputLines(surface, dataModel)
  return fields.length ? `${label}\n${fields.join('\n')}` : label
}

function buttonLabel(
  surface: UiSurface,
  button: Extract<UiComponent, { component: 'Button' }>
): string {
  const byId = new Map(surface.components.map((component) => [component.id, component]))
  const label = byId.get(button.child)
  if (label?.component !== 'Text') return ''
  return resolveText(label.text, surface.dataModel)
}

function buttonsOf(surface: UiSurface): Extract<UiComponent, { component: 'Button' }>[] {
  return surface.components.filter(
    (component): component is Extract<UiComponent, { component: 'Button' }> =>
      component.component === 'Button'
  )
}

function inputLines(surface: UiSurface, dataModel: Record<string, string | string[]>): string[] {
  const lines: string[] = []
  const walk = (id: string): void => {
    const component = surface.components.find((item) => item.id === id)
    if (!component) return
    if (component.component === 'TextField') {
      const value = dataModel[pathKey(component.value)]
      const text = typeof value === 'string' ? value : ''
      if (text.trim()) lines.push(`${component.label}: ${text}`)
      return
    }
    if (component.component === 'ChoicePicker') {
      const key = pathKey(component.value)
      const raw = dataModel[key]
      const selected = component.multiple
        ? Array.isArray(raw)
          ? raw
          : []
        : typeof raw === 'string' && raw
          ? [raw]
          : []
      if (!selected.length) return
      const labels = selected.map(
        (value) => component.options.find((option) => option.value === value)?.label ?? value
      )
      lines.push(`${component.label ?? key}: ${labels.join(', ')}`)
      return
    }
    if (component.component === 'Column' || component.component === 'Row') {
      for (const child of component.children) walk(child)
    }
  }
  walk('root')
  return lines
}
