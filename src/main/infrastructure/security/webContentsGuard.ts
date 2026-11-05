import log from 'electron-log'
import { app, session, shell } from 'electron'

/** Only web and mail links leave the app; a file:// or custom-scheme link from model text would launch what it points at. */
const EXTERNAL_SCHEMES = new Set(['https:', 'http:', 'mailto:'])
/** Permissions Talyx's own pages may use: the microphone, for dictation in the composer, and
 *  writing to the clipboard, for the Copy buttons. */
const APP_PERMISSIONS = new Set(['media', 'clipboard-sanitized-write'])

export function isSafeExternalUrl(url: string): boolean {
  try {
    return EXTERNAL_SCHEMES.has(new URL(url).protocol)
  } catch {
    return false
  }
}

/** appRoot ends in `/`: the dev server origin, or the packaged renderer folder as a file URL. */
export function isAppUrl(url: string, appRoot: string): boolean {
  return url.startsWith(appRoot)
}

export function isAllowedPermission(
  permission: string,
  details: { requestingUrl: string; mediaTypes?: string[] },
  appRoot: string
): boolean {
  // 'media' covers the camera too; dictation only ever asks for audio.
  const audioOnly =
    permission !== 'media' ||
    (!!details.mediaTypes?.length && details.mediaTypes.every((type) => type === 'audio'))
  return APP_PERMISSIONS.has(permission) && audioOnly && isAppUrl(details.requestingUrl, appRoot)
}

/** A check names one media type, or `unknown` when it asks about devices in general; only a
 *  video check is refused here, and capturing still goes through the request handler. */
export function checkedRequest(
  origin: string,
  details: { requestingUrl?: string; mediaType?: string }
): { requestingUrl: string; mediaTypes: string[] } {
  return {
    requestingUrl: details.requestingUrl ?? `${origin}/`,
    mediaTypes: [details.mediaType === 'video' ? 'video' : 'audio']
  }
}

/**
 * Every window Talyx creates — main, splash, and anything a link tries
 * to open — follows the same rules: no new Electron windows (web links go to the
 * browser), no navigating away from the app's own pages (a dropped .html file or
 * a model-written link would otherwise load with the preload attached), and
 * permissions only for the app's own pages. Install before creating any window.
 */
export function installWebContentsGuard(appRoot: string): void {
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback, details) =>
    callback(isAllowedPermission(permission, details, appRoot))
  )
  // Checks (a permission's status, without a prompt) are otherwise granted by default.
  session.defaultSession.setPermissionCheckHandler((_contents, permission, origin, details) =>
    isAllowedPermission(permission, checkedRequest(origin, details), appRoot)
  )
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      if (isSafeExternalUrl(url))
        shell
          .openExternal(url)
          .catch((error: unknown) => log.warn('[Guard] No app opened the link', error))
      return { action: 'deny' }
    })
    contents.on('will-navigate', (event, url) => {
      if (!isAppUrl(url, appRoot)) event.preventDefault()
    })
  })
}
