import type { UiComponent, UiSurface } from '@contract/a2uiSurface'
import { pathKey, resolveText } from '@contract/a2uiSurface'
import type { ChatItem } from './types'

type SurfaceItem = Extract<ChatItem, { kind: 'surface' }>

export type SurfaceAnswer = {
  answered: boolean
  pickedButtonId: string | null
  /** What the inputs held when a button of this surface sent them; null for any other answer. */
  values: Record<string, string | string[]> | null
  /** True while its buttons can be pressed: not settled, and the chat is quiet. */
  open: boolean
}

const UNANSWERED: SurfaceAnswer = {
  answered: false,
  pickedButtonId: null,
  values: null,
  open: false
}

/**
 * Where a surface stands. One card asks at a time: a user message after it settles it, and so does
 * a later card that has buttons of its own, so an answer always belongs to the card just before
 * it. A card that is not settled is `open` only while the chat is quiet (`busy` false: the bot is
 * not answering and nothing of yours waits to go), so a click goes out at once, right after its
 * card, and never waits behind an answer that may bring a newer card.
 */
export function surfaceAnswer(
  items: ChatItem[],
  surface: SurfaceItem,
  busy: boolean
): SurfaceAnswer {
  const at = items.findIndex((item) => item.id === surface.id)
  if (at < 0) return UNANSWERED
  const after = items.slice(at + 1)
  const userAt = after.findIndex((item) => item.kind === 'user')
  const before = userAt < 0 ? after : after.slice(0, userAt)
  if (before.some((item) => item.kind === 'surface' && buttonsOf(item.surface).length > 0))
    return SETTLED
  const next = after[userAt]
  if (next?.kind === 'user') return answerFrom(surface.surface, next.text) ?? SETTLED
  return { ...UNANSWERED, open: !busy }
}

// Settled without one of its buttons: you answered in your own words, or a newer card took over.
const SETTLED: SurfaceAnswer = {
  answered: true,
  pickedButtonId: null,
  values: null,
  open: false
}

/** The answer a message is when one of the surface's buttons sent it; null for any other text. */
function answerFrom(surface: UiSurface, text: string): SurfaceAnswer | null {
  const [firstLine = '', ...lines] = text.split('\n')
  const picked = buttonsOf(surface).find((button) => buttonLabel(surface, button) === firstLine)
  return picked
    ? { answered: true, pickedButtonId: picked.id, values: sentValues(surface, lines), open: false }
    : null
}

// The inverse of the click message's input lines, so an answered form shows what was sent.
function sentValues(surface: UiSurface, lines: string[]): Record<string, string | string[]> {
  const values: Record<string, string | string[]> = {}
  for (const component of surface.components) {
    if (component.component !== 'TextField' && component.component !== 'ChoicePicker') continue
    const key = pathKey(component.value)
    const opening = `${component.label ?? key}: `
    const sent = lines.find((line) => line.startsWith(opening))?.slice(opening.length)
    if (component.component === 'TextField') values[key] = sent ?? ''
    else {
      const chosen = (sent ? sent.split(', ') : []).flatMap((label) => {
        const option = component.options.find((item) => item.label === label)
        return option ? [option.value] : []
      })
      values[key] = component.multiple ? chosen : (chosen[0] ?? '')
    }
  }
  return values
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
  const byId = new Map(surface.components.map((component) => [component.id, component]))
  const walk = (id: string): void => {
    const component = byId.get(id)
    if (!component) return
    if (component.component === 'TextField') {
      const value = dataModel[pathKey(component.value)]
      const text = typeof value === 'string' ? value.replace(/\r\n|\n|\r/g, ' ') : ''
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
