/**
 * `profiles.configure` params that replace each `ui_meta[key]` in `records` only if every one is
 * still at its `revision` (`ui_meta_revisions[key]` in `profiles.list`); one stale key and the
 * engine writes none. The bot keys carry the engine's own name, so they are never written in this
 * repo: callers pass `botMetaKey` / `botGroupsMetaKey` from the attached `EngineStatus`.
 */
export function metaPatch(
  name: string,
  records: Record<string, { meta: unknown; revision: number }>
): Record<string, unknown> {
  const entries = Object.entries(records)
  return {
    name,
    ui_meta: Object.fromEntries(entries.map(([key, record]) => [key, record.meta])),
    ui_meta_expected_revisions: Object.fromEntries(
      entries.map(([key, record]) => [key, record.revision])
    )
  }
}
