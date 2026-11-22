// A2UI v1.0 surfaces for show_ui: one parser the MCP tool and the renderer share.

import { z } from 'zod'
import { MCP_SERVER_NAME } from './mcpServerName'

/** The catalog every show_ui surface names. */
export const MCP_UI_CATALOG = 'https://talyx.app/a2ui/catalog/v1'
/** Total JSON bytes show_ui accepts for one surface. */
export const MCP_SHOW_UI_MAX_BYTES = 32_768

/** How many components one surface may have. */
export const MCP_UI_MAX_COMPONENTS = 48
/** Table body rows, not counting the header. */
export const MCP_UI_MAX_TABLE_ROWS = 24
/** Points per chart series (labels length). */
export const MCP_UI_MAX_CHART_POINTS = 31
/** Series in one chart (legend when more than one). */
export const MCP_UI_MAX_CHART_SERIES = 4
/** One string field in a Text, label, cell, or similar. */
export const MCP_UI_TEXT_MAX = 400
/** The largest value a chart series may carry. */
export const MCP_UI_CHART_VALUE_MAX = 1e12

const DATA_MODEL_FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype'])

const uiId = z
  .string()
  .regex(/^[\p{L}_][\p{L}\p{N}_]*$/u, 'An id has letters, digits and underscores only, no hyphen')

const pathBinding = z.object({ '@path': z.string().regex(/^\/[\p{L}_][\p{L}\p{N}_]*$/u) })

const textValue = z.union([z.string().max(MCP_UI_TEXT_MAX), pathBinding])

const variant = z.enum(['body', 'heading', 'caption'])

const rawComponent = z.discriminatedUnion('component', [
  z.object({
    id: uiId,
    component: z.literal('Text'),
    text: textValue,
    variant: variant.optional()
  }),
  z.object({
    id: uiId,
    component: z.literal('Column'),
    children: z.array(uiId).min(1)
  }),
  z.object({
    id: uiId,
    component: z.literal('Row'),
    children: z.array(uiId).min(1)
  }),
  z.object({ id: uiId, component: z.literal('Divider') }),
  z.object({
    id: uiId,
    component: z.literal('Stat'),
    label: z.string().max(MCP_UI_TEXT_MAX),
    value: z.string().max(MCP_UI_TEXT_MAX),
    note: z.string().max(MCP_UI_TEXT_MAX).optional(),
    tone: z.enum(['up', 'down']).optional()
  }),
  z.object({
    id: uiId,
    component: z.literal('Chart'),
    kind: z.enum(['bar', 'line', 'area', 'pie']),
    labels: z.array(z.string().max(MCP_UI_TEXT_MAX)).min(1),
    series: z
      .array(
        z.object({
          name: z.string().max(MCP_UI_TEXT_MAX),
          values: z.array(z.number().finite().nonnegative())
        })
      )
      .min(1),
    unit: z.string().max(MCP_UI_TEXT_MAX).optional()
  }),
  z.object({
    id: uiId,
    component: z.literal('Table'),
    columns: z.array(
      z.object({
        label: z.string().max(MCP_UI_TEXT_MAX),
        align: z.enum(['left', 'right']).optional(),
        kind: z.enum(['bar']).optional()
      })
    ),
    rows: z.array(z.array(z.union([z.string().max(MCP_UI_TEXT_MAX), z.number().finite()])))
  }),
  z.object({
    id: uiId,
    component: z.literal('Button'),
    child: uiId,
    variant: z.literal('primary').optional(),
    action: z.object({
      event: z.object({
        name: z.string().min(1).max(MCP_UI_TEXT_MAX),
        context: z.record(z.string(), z.unknown()).optional()
      })
    })
  }),
  z.object({
    id: uiId,
    component: z.literal('ChoicePicker'),
    label: z.string().max(MCP_UI_TEXT_MAX).optional(),
    options: z.array(
      z.object({
        label: z.string().max(MCP_UI_TEXT_MAX),
        value: z.string().max(MCP_UI_TEXT_MAX)
      })
    ),
    value: pathBinding,
    multiple: z.boolean().optional()
  }),
  z.object({
    id: uiId,
    component: z.literal('TextField'),
    label: z.string().max(MCP_UI_TEXT_MAX),
    value: pathBinding,
    placeholder: z.string().max(MCP_UI_TEXT_MAX).optional()
  })
])

export type UiComponent = z.infer<typeof rawComponent>

export type UiSurface = {
  surfaceId: string
  components: UiComponent[]
  dataModel: Record<string, string | string[]>
}

export type UiParseResult = { ok: true; surface: UiSurface } | { ok: false; reason: string }

const messageCount = z
  .array(z.record(z.string(), z.unknown()))
  .min(2)
  .max(3)
  .describe('createSurface, updateComponents, then optionally updateDataModel')

/** The only gate for show_ui messages: count, version on every message, then parse. */
export function gateShowUiMessages(messages: unknown[]): string | null {
  if (!Array.isArray(messages)) return 'The messages must be an array.'
  if (messages.length < 2) return 'Too small: expected array to have >=2 items'
  if (messages.length > 3) return 'Too big: expected array to have <=3 items'
  for (const message of messages) {
    if (!message || typeof message !== 'object') return 'Each message must be an object.'
    const version = (message as Record<string, unknown>).version
    if (version !== '1.0') return 'Each message needs version "1.0".'
  }
  return null
}

/** Tool arguments for show_ui (messages array only). */
export const showUiMessagesSchema = z
  .object({
    messages: messageCount
  })
  .superRefine((value, ctx) => {
    const reason = gateShowUiMessages(value.messages)
    if (reason) ctx.addIssue({ code: 'custom', message: reason })
  })

export function parseA2uiSurface(raw: unknown): UiParseResult {
  if (!raw || typeof raw !== 'object' || !('messages' in raw)) {
    return { ok: false, reason: 'Invalid arguments.' }
  }
  const messages = (raw as { messages: unknown }).messages
  return Array.isArray(messages)
    ? parseA2uiMessages(messages)
    : { ok: false, reason: 'Invalid arguments.' }
}

export function parseA2uiMessages(messages: unknown[]): UiParseResult {
  const gate = gateShowUiMessages(messages)
  if (gate) return { ok: false, reason: gate }
  const bytes = new TextEncoder().encode(JSON.stringify(messages)).length
  if (bytes > MCP_SHOW_UI_MAX_BYTES)
    return {
      ok: false,
      reason: `The messages are too large (${bytes} bytes, limit ${MCP_SHOW_UI_MAX_BYTES}).`
    }
  return parseMessages(messages as Record<string, unknown>[])
}

function parseMessages(messages: Record<string, unknown>[]): UiParseResult {
  const create = messages.find((message) => 'createSurface' in message)
  const update = messages.find((message) => 'updateComponents' in message)
  const model = messages.find((message) => 'updateDataModel' in message)
  if (!create || !update)
    return { ok: false, reason: 'The messages need createSurface and updateComponents.' }
  const createSurface = create.createSurface as Record<string, unknown> | undefined
  const catalogId = createSurface?.catalogId
  if (catalogId !== MCP_UI_CATALOG)
    return { ok: false, reason: `The catalogId must be "${MCP_UI_CATALOG}".` }
  const surfaceId = createSurface?.surfaceId
  if (typeof surfaceId !== 'string' || !surfaceId.trim())
    return { ok: false, reason: 'createSurface needs a surfaceId.' }
  const updateComponents = update.updateComponents as Record<string, unknown> | undefined
  if (updateComponents?.surfaceId !== surfaceId)
    return { ok: false, reason: 'updateComponents.surfaceId must match createSurface.surfaceId.' }
  const list = updateComponents?.components
  if (!Array.isArray(list) || list.length === 0)
    return { ok: false, reason: 'updateComponents needs a non-empty components list.' }
  if (list.length > MCP_UI_MAX_COMPONENTS)
    return {
      ok: false,
      reason: `Too many components (${list.length}, limit ${MCP_UI_MAX_COMPONENTS}).`
    }
  const components: UiComponent[] = []
  for (const raw of list) {
    const parsed = rawComponent.safeParse(raw)
    if (!parsed.success) {
      const id =
        typeof raw === 'object' && raw && 'id' in raw ? String((raw as { id: unknown }).id) : '?'
      return {
        ok: false,
        reason: `Component "${id}": ${parsed.error.issues[0]?.message ?? 'invalid shape.'}`
      }
    }
    const check = limitsFor(parsed.data)
    if (check) return { ok: false, reason: check }
    components.push(parsed.data)
  }
  const ids = components.map((component) => component.id)
  const dupId = ids.find((id, index) => ids.indexOf(id) !== index)
  if (dupId !== undefined) return { ok: false, reason: `Two components share the id "${dupId}".` }
  const byId = new Map(components.map((component) => [component.id, component]))
  if (!byId.has('root')) return { ok: false, reason: 'No component has the id "root".' }
  for (const component of components) {
    if (component.component === 'Column' || component.component === 'Row') {
      if (new Set(component.children).size !== component.children.length)
        return {
          ok: false,
          reason: `Component "${component.id}" names the same child twice.`
        }
    }
    if (component.component === 'Button') {
      const child = byId.get(component.child)
      if (child?.component !== 'Text')
        return {
          ok: false,
          reason: `Component "${component.id}": a Button's child must be a Text.`
        }
    }
    if (component.component === 'TextField' || component.component === 'ChoicePicker') {
      const key = pathKey(component.value)
      if (DATA_MODEL_FORBIDDEN.has(key))
        return { ok: false, reason: `The data model key "${key}" is not allowed.` }
    }
  }
  const childIds = childReferences(components)
  for (const child of childIds) {
    if (!byId.has(child)) return { ok: false, reason: `No component has the id "${child}".` }
  }
  const cycle = findCycle(components)
  if (cycle) return { ok: false, reason: `A cycle includes component "${cycle}".` }
  const dataModel = readDataModel(model, surfaceId, components)
  if (typeof dataModel === 'string') return { ok: false, reason: dataModel }
  const labels = clickAmbiguity(components, byId)
  if (labels) return { ok: false, reason: labels }
  return { ok: true, surface: { surfaceId, components, dataModel } }
}

function limitsFor(component: UiComponent): string | null {
  if (component.component === 'Table') {
    if (component.rows.length > MCP_UI_MAX_TABLE_ROWS)
      return `Component "${component.id}": too many table rows (${component.rows.length}, limit ${MCP_UI_MAX_TABLE_ROWS}).`
    const columns = component.columns.length
    for (const [rowIndex, row] of component.rows.entries()) {
      if (row.length !== columns)
        return `Component "${component.id}": row ${rowIndex + 1} has ${row.length} cells, but the table has ${columns} columns.`
    }
    for (const [columnIndex, column] of component.columns.entries()) {
      if (column.kind !== 'bar') continue
      for (const row of component.rows) {
        const cell = row[columnIndex]
        if (typeof cell !== 'number' || !Number.isFinite(cell) || cell < 0 || cell > 100)
          return `Component "${component.id}": column "${column.label}" must be a percentage from 0 to 100.`
      }
    }
  }
  if (component.component === 'Chart') {
    if (component.labels.length > MCP_UI_MAX_CHART_POINTS)
      return `Component "${component.id}": too many chart points (${component.labels.length}, limit ${MCP_UI_MAX_CHART_POINTS}).`
    if (component.series.length > MCP_UI_MAX_CHART_SERIES)
      return `Component "${component.id}": too many chart series (${component.series.length}, limit ${MCP_UI_MAX_CHART_SERIES}).`
    if (component.kind === 'pie' && component.series.length > 1)
      return `Component "${component.id}": a pie chart must have one series.`
    if (component.kind === 'pie' && component.labels.length > MCP_UI_MAX_CHART_SERIES)
      return `Component "${component.id}": a pie has up to ${MCP_UI_MAX_CHART_SERIES} slices (${component.labels.length} given). Use a bar chart for more.`
    for (const series of component.series) {
      if (series.values.length !== component.labels.length)
        return `Component "${component.id}": labels and values length differ for series "${series.name}".`
      for (const value of series.values) {
        if (value > MCP_UI_CHART_VALUE_MAX)
          return `Component "${component.id}": chart values must be at most ${MCP_UI_CHART_VALUE_MAX}.`
      }
    }
  }
  return null
}

function childrenOf(component: UiComponent): string[] {
  if (component.component === 'Column' || component.component === 'Row') return component.children
  if (component.component === 'Button') return [component.child]
  return []
}

function childReferences(components: UiComponent[]): string[] {
  return components.flatMap((component) => childrenOf(component))
}

function findCycle(components: UiComponent[]): string | null {
  const byId = new Map(components.map((component) => [component.id, component]))
  const visiting = new Set<string>()
  const seen = new Set<string>()
  const walk = (id: string): string | null => {
    if (seen.has(id)) return null
    if (visiting.has(id)) return id
    visiting.add(id)
    const component = byId.get(id)
    for (const child of component ? childrenOf(component) : []) {
      const found = walk(child)
      if (found) return found
    }
    visiting.delete(id)
    seen.add(id)
    return null
  }
  return walk('root')
}

function readDataModel(
  message: Record<string, unknown> | undefined,
  surfaceId: string,
  components: UiComponent[]
): Record<string, string | string[]> | string {
  const bindings = bindingsOf(components)
  for (const key of bindings) {
    if (DATA_MODEL_FORBIDDEN.has(key)) return `The data model key "${key}" is not allowed.`
  }
  if (!message) {
    const dataModel: Record<string, string | string[]> = {}
    for (const key of bindings) dataModel[key] = ''
    return dataModel
  }
  const update = message.updateDataModel as Record<string, unknown> | undefined
  if (update?.surfaceId !== surfaceId)
    return 'updateDataModel.surfaceId must match createSurface.surfaceId.'
  const value = update.value
  if (!value || typeof value !== 'object') return 'updateDataModel needs a value object.'
  const record = value as Record<string, unknown>
  const dataModel: Record<string, string | string[]> = {}
  for (const key of bindings) {
    if (!Object.hasOwn(record, key)) {
      const picker = components.find(
        (component) => component.component === 'ChoicePicker' && pathKey(component.value) === key
      )
      dataModel[key] = picker?.component === 'ChoicePicker' && picker.multiple ? [] : ''
      continue
    }
    const raw = record[key]
    const picker = components.find(
      (component) => component.component === 'ChoicePicker' && pathKey(component.value) === key
    )
    if (picker?.component === 'ChoicePicker' && picker.multiple) {
      if (!Array.isArray(raw) || !raw.every((item) => typeof item === 'string'))
        return `The data model key "${key}" must be a string array for a multiple choice.`
      dataModel[key] = raw
    } else if (typeof raw === 'string') dataModel[key] = raw
    else return `The data model key "${key}" must be a string.`
  }
  return dataModel
}

function bindingsOf(components: UiComponent[]): string[] {
  return [
    ...new Set(
      components.flatMap((component) => {
        if (component.component === 'TextField' || component.component === 'ChoicePicker')
          return [pathKey(component.value)]
        return []
      })
    )
  ]
}

function buttonLabelText(
  byId: Map<string, UiComponent>,
  button: Extract<UiComponent, { component: 'Button' }>
): string {
  const label = byId.get(button.child)
  if (label?.component !== 'Text' || typeof label.text !== 'string') return ''
  return label.text
}

function clickAmbiguity(components: UiComponent[], byId: Map<string, UiComponent>): string | null {
  const inputLabels: string[] = []
  for (const component of components) {
    if (component.component === 'TextField') {
      if (lineBreak(component.label))
        return `Component "${component.id}": input labels must not contain a line break.`
      inputLabels.push(component.label)
    }
    if (component.component === 'ChoicePicker') {
      const name = component.label ?? pathKey(component.value)
      if (lineBreak(name))
        return `Component "${component.id}": input labels must not contain a line break.`
      inputLabels.push(name)
      const seen = new Set<string>()
      for (const option of component.options) {
        if (lineBreak(option.label))
          return `Component "${component.id}": option labels must not contain a line break.`
        if (option.label.includes(', '))
          return `Component "${component.id}": option label "${option.label}" must not contain ", ".`
        if (seen.has(option.label))
          return `Component "${component.id}": two options share the label "${option.label}".`
        seen.add(option.label)
      }
    }
    if (component.component === 'Button') {
      const label = buttonLabelText(byId, component)
      if (lineBreak(label))
        return `Component "${component.id}": button labels must not contain a line break.`
    }
  }
  const dupInput = inputLabels.find((label, index) => inputLabels.indexOf(label) !== index)
  if (dupInput) return `Two inputs share the label "${dupInput}".`
  const buttonLabels = components
    .filter(
      (component): component is Extract<UiComponent, { component: 'Button' }> =>
        component.component === 'Button'
    )
    .map((button) => buttonLabelText(byId, button))
  const dupButton = buttonLabels.find((label, index) => buttonLabels.indexOf(label) !== index)
  if (dupButton) return `Two buttons share the label "${dupButton}".`
  return null
}

function lineBreak(text: string): boolean {
  return text.includes('\n') || text.includes('\r')
}

export function pathKey(binding: { '@path': string }): string {
  return binding['@path'].slice(1)
}

export function resolveText(
  text: string | { '@path': string },
  dataModel: Record<string, string | string[]>
): string {
  if (typeof text === 'string') return text
  const value = dataModel[pathKey(text)]
  return typeof value === 'string' ? value : ''
}

/** Reads show_ui messages from a stored tool name and args (direct or engine tool_call wrapper). */
export function showUiMessagesFromTool(
  name: string,
  args: Record<string, unknown>
): unknown[] | null {
  if (!isShowUiToolName(name) && name !== ENGINE_TOOL_CALL) return null
  const wrapped = unwrapToolCalls(args).find((call) => isShowUiToolName(call.name))?.arguments
  const messages = args.messages ?? wrapped?.messages
  return Array.isArray(messages) ? messages : null
}

export function isShowUiToolName(name: string): boolean {
  return name === 'show_ui' || name === `mcp__${MCP_SERVER_NAME}__show_ui`
}

const ENGINE_TOOL_CALL = 'tool_call'

function unwrapToolCalls(
  args: Record<string, unknown>
): Array<{ name: string; arguments: Record<string, unknown> }> {
  const raw = args.calls
  if (!Array.isArray(raw)) return []
  return raw.flatMap((call) => {
    if (!call || typeof call !== 'object') return []
    const row = call as Record<string, unknown>
    const name = typeof row.name === 'string' ? row.name : ''
    const arguments_ = row.arguments
    return name && arguments_ && typeof arguments_ === 'object'
      ? [{ name, arguments: arguments_ as Record<string, unknown> }]
      : []
  })
}
