import { net, protocol } from 'electron'
import { isAbsolute, join, relative } from 'path'
import { pathToFileURL } from 'url'
import { MODULE_SCHEME } from '../../../shared/modules'

const SCHEME = 'app'
const HOST = 'talyx'

/** Where the packaged renderer is served from; `'self'` in its CSP means this origin. */
export const APP_ROOT = `${SCHEME}://${HOST}/`

/**
 * The file an app URL names inside the renderer folder, or null when it names anything else.
 * Pure, so the traversal checks are testable without Electron.
 */
export function rendererFile(url: string, rendererDir: string): string | null {
  const parsed = new URL(url)
  if (parsed.protocol !== `${SCHEME}:` || parsed.host !== HOST) return null
  let pathname: string
  try {
    pathname = decodeURIComponent(parsed.pathname)
  } catch {
    return null
  }
  const file = join(rendererDir, pathname)
  const inside = relative(rendererDir, file)
  return inside && !inside.startsWith('..') && !isAbsolute(inside) ? file : null
}

/**
 * Must run before the app is ready: a scheme's privileges are fixed at startup, and every scheme
 * goes in this one call. The module scheme serves module scripts to the page (modules.ipc.ts);
 * it is cross-origin from the page, hence CORS.
 */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
    {
      scheme: MODULE_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true }
    }
  ])
}

/**
 * Serves the packaged renderer over `app://talyx/` instead of `file://`, so a page gets a real
 * origin and no file-protocol privileges (the grantFileProtocolExtraPrivileges fuse is off): a
 * script that ever ran in it could not read other files on disk.
 */
export function serveRenderer(rendererDir: string): void {
  protocol.handle(SCHEME, (request) => {
    const file = rendererFile(request.url, rendererDir)
    return file ? net.fetch(pathToFileURL(file).href) : new Response(null, { status: 404 })
  })
}
