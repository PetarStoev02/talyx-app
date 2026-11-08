import { z } from 'zod/v4'
import { ModuleIdSchema } from './signing'

/** The published list of modules: built, signed bundles only, never their source. */
export const CATALOG_URL =
  'https://github.com/PetarStoev02/talyx-modules-dist/releases/latest/download/index.json'

const FETCH_TIMEOUT_MS = 30_000
/** Far above any real module; stops a broken or hostile server from filling memory. */
export const MAX_BUNDLE_BYTES = 20 * 1024 * 1024

const CatalogEntrySchema = z.object({
  id: ModuleIdSchema,
  name: z.string().min(1).max(100),
  version: z.string().max(50),
  apiVersion: z.number().int().positive(),
  url: z.url({ protocol: /^https$/ }),
  /** The module key's signature over the bundle's bytes (base64url). */
  signature: z.string().min(1).max(200)
})

const CatalogSchema = z.object({ modules: z.array(CatalogEntrySchema) })

export type CatalogEntry = z.infer<typeof CatalogEntrySchema>

export class CatalogError extends Error {
  override name = 'CatalogError'
}

/** The catalog's entries. The URL and versions here are only hints: the signature decides. */
export async function fetchCatalog(fetchFn: typeof fetch): Promise<CatalogEntry[]> {
  const parsed = CatalogSchema.safeParse(await fetchJson(fetchFn, CATALOG_URL))
  if (!parsed.success) throw new CatalogError('The module list is damaged.')
  return parsed.data.modules
}

export async function fetchBundleBytes(fetchFn: typeof fetch, url: string): Promise<Buffer> {
  const response = await fetchOk(fetchFn, url)
  if (Number(response.headers.get('content-length') ?? 0) > MAX_BUNDLE_BYTES) throw tooLarge()
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length > MAX_BUNDLE_BYTES) throw tooLarge()
  return bytes
}

function tooLarge(): CatalogError {
  return new CatalogError('The module download is larger than any module can be.')
}

async function fetchJson(fetchFn: typeof fetch, url: string): Promise<unknown> {
  const response = await fetchOk(fetchFn, url)
  try {
    return await response.json()
  } catch {
    throw new CatalogError('The module list is damaged.')
  }
}

async function fetchOk(fetchFn: typeof fetch, url: string): Promise<Response> {
  let response: Response
  try {
    response = await fetchFn(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  } catch (error) {
    throw new CatalogError(
      `Talyx could not reach the module download (${error instanceof Error ? error.message : String(error)}).`
    )
  }
  if (!response.ok)
    throw new CatalogError(
      `The module download answered ${response.status} ${response.statusText}.`
    )
  return response
}
