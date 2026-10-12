/** Kept in step with the app's package.json version at release time. */
export const APP_VERSION = '0.11.0'

export const REPO_URL = 'https://github.com/PetarStoev02/talyx-app'
export const ISSUES_URL = `${REPO_URL}/issues`
export const SECURITY_REPORT_URL = `${REPO_URL}/security/advisories/new`

/** GitHub serves the newest release's assets under this stable path. */
const DOWNLOAD_BASE = `${REPO_URL}/releases/latest/download`

export const DOWNLOADS = {
  appleSilicon: `${DOWNLOAD_BASE}/Talyx-arm64.dmg`,
  intel: `${DOWNLOAD_BASE}/Talyx-x64.dmg`
} as const
