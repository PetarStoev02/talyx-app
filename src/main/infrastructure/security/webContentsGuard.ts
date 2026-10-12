import { app, session, shell } from 'electron'

/** Only web and mail links leave the app; a file:// or custom-scheme link from model text would launch what it points at. */
const EXTERNAL_SCHEMES = new Set(['https:', 'http:', 'mailto:'])
/** What Talyx's own pages ask for: dictation, copy buttons, notices. */
const APP_PERMISSIONS = new Set(['media', 'clipboard-sanitized-write', 'notifications'])

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
  requestingUrl: string,
  appRoot: string
): boolean {
  return APP_PERMISSIONS.has(permission) && isAppUrl(requestingUrl, appRoot)
}

/**
 * Every window Talyx creates — main, overlay, splash, and anything a link tries
 * to open — follows the same rules: no new Electron windows (web links go to the
 * browser), no navigating away from the app's own pages (a dropped .html file or
 * a model-written link would otherwise load with the preload attached), and
 * permissions only for the app's own pages. Install before creating any window.
 */
export function installWebContentsGuard(appRoot: string): void {
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback, details) =>
    callback(isAllowedPermission(permission, details.requestingUrl, appRoot))
  )
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      if (isSafeExternalUrl(url)) void shell.openExternal(url)
      return { action: 'deny' }
    })
    contents.on('will-navigate', (event, url) => {
      if (!isAppUrl(url, appRoot)) event.preventDefault()
    })
  })
}
