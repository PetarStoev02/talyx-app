/**
 * Bot metadata as profile rows carry it (`profiles.list`): `ui_meta[key]` plus its CAS revision
 * in `ui_meta_revisions[key]`. The keys carry the engine's own name, so they are never written in
 * this repo: callers pass `botMetaKey` / `botGroupsMetaKey` from the attached `EngineStatus`.
 */
export interface ProfileMetaRow {
  name: string
  ui_meta?: Record<string, unknown> | null
  ui_meta_revisions?: Record<string, number> | null
}

export interface MetaRecord {
  meta: Record<string, unknown> | null
  revision: number
}

export function readMeta(row: ProfileMetaRow, key: string): MetaRecord {
  const meta = row.ui_meta?.[key]
  return {
    meta:
      meta && typeof meta === 'object' && !Array.isArray(meta)
        ? (meta as Record<string, unknown>)
        : null,
    revision: row.ui_meta_revisions?.[key] ?? 0
  }
}

/** `profiles.configure` params that replace `ui_meta[key]` only if it is still at `revision`. */
export function metaPatch(
  name: string,
  key: string,
  record: { meta: Record<string, unknown>; revision: number }
): Record<string, unknown> {
  return {
    name,
    ui_meta: { [key]: record.meta },
    ui_meta_expected_revisions: { [key]: record.revision }
  }
}
