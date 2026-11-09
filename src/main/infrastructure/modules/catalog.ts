import { z } from 'zod/v4'
import { ModuleIdSchema } from './signing'

/**
 * The published list of modules: built, signed bundles only, never their source. The server
 * answers only a valid license key, and lists and serves only the modules that key unlocks.
 */
export const CATALOG_URL = 'https://modules.talyx.app/index.json'

const FETCH_TIMEOUT_MS = 30_000
const UNAUTHORIZED = 401
const FORBIDDEN = 403
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
export async function fetchCatalog(
  fetchFn: typeof fetch,
  licenseKey: string
): Promise<CatalogEntry[]> {
  const parsed = CatalogSchema.safeParse(await fetchJson(fetchFn, CATALOG_URL, licenseKey))
  if (!parsed.success) throw new CatalogError('The module list is damaged.')
  return parsed.data.modules
}

/** Only from the catalog's own server: the license key is never sent anywhere else. */
export async function fetchBundleBytes(
  fetchFn: typeof fetch,
  url: string,
  licenseKey: string
): Promise<Buffer> {
  if (new URL(url).origin !== new URL(CATALOG_URL).origin)
    throw new CatalogError('The module list points to a download Talyx does not trust.')
  const response = await fetchOk(fetchFn, url, licenseKey)
  if (Number(response.headers.get('content-length') ?? 0) > MAX_BUNDLE_BYTES) throw tooLarge()
  return readCapped(response)
}

/** The body, stopped as soon as it passes the cap: a missing or false length is not trusted. */
async function readCapped(response: Response): Promise<Buffer> {
  const chunks: Uint8Array[] = []
  let total = 0
  // Leaving the loop early (the throw) cancels the stream.
  for await (const chunk of response.body ?? []) {
    total += chunk.length
    if (total > MAX_BUNDLE_BYTES) throw tooLarge()
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

function tooLarge(): CatalogError {
  return new CatalogError('The module download is larger than any module can be.')
}

async function fetchJson(fetchFn: typeof fetch, url: string, licenseKey: string): Promise<unknown> {
  const response = await fetchOk(fetchFn, url, licenseKey)
  try {
    return await response.json()
  } catch {
    throw new CatalogError('The module list is damaged.')
  }
}

async function fetchOk(fetchFn: typeof fetch, url: string, licenseKey: string): Promise<Response> {
  let response: Response
  try {
    response = await fetchFn(url, {
      headers: { authorization: `Bearer ${licenseKey}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    })
  } catch (error) {
    throw new CatalogError(
      `Talyx could not reach the module download (${error instanceof Error ? error.message : String(error)}).`
    )
  }
  if (response.status === UNAUTHORIZED)
    throw new CatalogError('The module server did not accept this license key.')
  if (response.status === FORBIDDEN)
    throw new CatalogError('Your license does not include this module.')
  if (!response.ok)
    throw new CatalogError(
      `The module download answered ${response.status} ${response.statusText}.`
    )
  return response
}
