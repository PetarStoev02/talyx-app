/**
 * `profiles.configure` params that replace `ui_meta[key]` only if it is still at `revision`
 * (`ui_meta_revisions[key]` in `profiles.list`). The bot keys carry the engine's own name, so they
 * are never written in this repo: callers pass `botMetaKey` / `botGroupsMetaKey` from the attached
 * `EngineStatus`.
 */
export function metaPatch(
  name: string,
  key: string,
  record: { meta: unknown; revision: number }
): Record<string, unknown> {
  return {
    name,
    ui_meta: { [key]: record.meta },
    ui_meta_expected_revisions: { [key]: record.revision }
  }
}
