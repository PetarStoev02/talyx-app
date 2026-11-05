/** Kept in step with the app's package.json version at release time. */
export const APP_VERSION = '1.0.0'

export const REPO_URL = 'https://github.com/PetarStoev02/talyx-app'
export const ISSUES_URL = `${REPO_URL}/issues`
export const SECURITY_REPORT_URL = `${REPO_URL}/security/advisories/new`

/** GitHub serves the newest release's assets under this stable path. */
const DOWNLOAD_BASE = `${REPO_URL}/releases/latest/download`

/** The release's installer file names, the same on every release. */
export const ASSETS = {
  appleSilicon: 'Talyx-arm64.dmg',
  intel: 'Talyx-x64.dmg',
  appImage: 'Talyx-x86_64.AppImage',
  deb: 'Talyx-amd64.deb'
} as const

export const DOWNLOADS = {
  appleSilicon: `${DOWNLOAD_BASE}/${ASSETS.appleSilicon}`,
  intel: `${DOWNLOAD_BASE}/${ASSETS.intel}`,
  appImage: `${DOWNLOAD_BASE}/${ASSETS.appImage}`,
  deb: `${DOWNLOAD_BASE}/${ASSETS.deb}`
} as const
