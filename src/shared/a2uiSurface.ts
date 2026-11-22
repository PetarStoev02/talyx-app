// A2UI v1.0 surfaces for show_ui: one parser the MCP tool and the renderer share.

import { z } from 'zod'

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

const showUiMessagesSchema = z.object({
  messages: z
    .array(z.record(z.string(), z.unknown()))
    .min(2)
    .max(3)
    .describe('createSurface, updateComponents, then optionally updateDataModel')
})

/** Tool arguments for show_ui. */
export const showUiArgsSchema = showUiMessagesSchema

export function parseA2uiSurface(raw: unknown): UiParseResult {
  const bytes = JSON.stringify(raw)
  if (bytes.length > MCP_SHOW_UI_MAX_BYTES)
    return {
      ok: false,
      reason: `The messages are too large (${bytes.length} bytes, limit ${MCP_SHOW_UI_MAX_BYTES}).`
    }
  const args = showUiMessagesSchema.safeParse(raw)
  if (!args.success)
    return { ok: false, reason: args.error.issues[0]?.message ?? 'Invalid arguments.' }
  return parseMessages(args.data.messages)
}

export function parseA2uiMessages(messages: unknown[]): UiParseResult {
  const bytes = JSON.stringify(messages)
  if (bytes.length > MCP_SHOW_UI_MAX_BYTES)
    return {
      ok: false,
      reason: `The messages are too large (${bytes.length} bytes, limit ${MCP_SHOW_UI_MAX_BYTES}).`
    }
  if (!messages.every((message) => message && typeof message === 'object'))
    return { ok: false, reason: 'Each message must be an object.' }
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
  const byId = new Map(components.map((component) => [component.id, component]))
  if (!byId.has('root')) return { ok: false, reason: 'No component has the id "root".' }
  const childIds = childReferences(components)
  for (const child of childIds) {
    if (!byId.has(child)) return { ok: false, reason: `No component has the id "${child}".` }
  }
  const cycle = findCycle(components)
  if (cycle) return { ok: false, reason: `A cycle includes component "${cycle}".` }
  const dataModel = readDataModel(model, surfaceId, components)
  if (typeof dataModel === 'string') return { ok: false, reason: dataModel }
  return { ok: true, surface: { surfaceId, components, dataModel } }
}

function limitsFor(component: UiComponent): string | null {
  if (component.component === 'Table') {
    if (component.rows.length > MCP_UI_MAX_TABLE_ROWS)
      return `Component "${component.id}": too many table rows (${component.rows.length}, limit ${MCP_UI_MAX_TABLE_ROWS}).`
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
    if (component.kind === 'pie' && component.labels.length > MCP_UI_MAX_CHART_SERIES)
      return `Component "${component.id}": a pie has up to ${MCP_UI_MAX_CHART_SERIES} slices (${component.labels.length} given). Use a bar chart for more.`
    for (const series of component.series) {
      if (series.values.length !== component.labels.length)
        return `Component "${component.id}": labels and values length differ for series "${series.name}".`
    }
  }
  return null
}

function childReferences(components: UiComponent[]): string[] {
  return components.flatMap((component) => {
    if (component.component === 'Column' || component.component === 'Row') return component.children
    if (component.component === 'Button') return [component.child]
    return []
  })
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
    const children =
      component?.component === 'Column' || component?.component === 'Row'
        ? component.children
        : component?.component === 'Button'
          ? [component.child]
          : []
    for (const child of children) {
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
  const dataModel: Record<string, string | string[]> = {}
  for (const key of bindings) {
    const raw = (value as Record<string, unknown>)[key]
    const picker = components.find(
      (component) => component.component === 'ChoicePicker' && pathKey(component.value) === key
    )
    if (picker?.component === 'ChoicePicker' && picker.multiple) {
      if (!Array.isArray(raw) || !raw.every((item) => typeof item === 'string'))
        return `The data model key "${key}" must be a string array for a multiple choice.`
      dataModel[key] = raw
    } else if (typeof raw === 'string') dataModel[key] = raw
    else if (raw === undefined)
      dataModel[key] = picker?.component === 'ChoicePicker' && picker.multiple ? [] : ''
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
  // The engine stores the call inside its own wrapper even where the tool row carries the tool's
  // own name, so the messages are looked for in both places.
  const wrapped = unwrapToolCalls(args).find((call) => isShowUiToolName(call.name))?.arguments
  const messages = args.messages ?? wrapped?.messages
  return Array.isArray(messages) ? messages : null
}

export function isShowUiToolName(name: string): boolean {
  return name === 'show_ui' || name.endsWith('__show_ui') || name === 'mcp__talyx__show_ui'
}

// The engine's own function that carries a call to an MCP tool.
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
