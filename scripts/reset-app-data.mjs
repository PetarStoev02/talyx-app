#!/usr/bin/env node

/**
 * Clears Talyx app data for a fresh start.
 * Usage: npm run reset (or npm run dev:reset to reset and start the app)
 *
 * Deletes settings.json and the copies of files added to chats (attachments/) from Electron's
 * userData folder. Data left behind by the
 * file-organizer versions (talyx.db, models/) goes too.
 */

import { join } from 'path'
import { rmSync, existsSync } from 'fs'
import { homedir } from 'os'

// Electron's default userData location per OS
const configRoot =
  {
    darwin: join(homedir(), 'Library', 'Application Support'),
    win32: process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming')
  }[process.platform] ??
  process.env.XDG_CONFIG_HOME ??
  join(homedir(), '.config')
const appData = join(configRoot, 'talyx')
console.log(`\nClearing Talyx app data from: ${appData}\n`)

const targets = [
  { path: join(appData, 'settings.json'), label: 'Settings' },
  { path: join(appData, 'attachments'), label: 'Copies of files added to chats' },
  { path: join(appData, 'talyx.db'), label: 'Old database' },
  { path: join(appData, 'talyx.db-wal'), label: 'Old database WAL' },
  { path: join(appData, 'talyx.db-shm'), label: 'Old database SHM' },
  { path: join(appData, 'models'), label: 'Old voice models' },
  { path: join(appData, 'transformers-models'), label: 'Old Transformers.js models' }
]

let cleared = 0
for (const { path, label } of targets) {
  if (!existsSync(path)) continue
  try {
    rmSync(path, { recursive: true })
    console.log(`  ✓ ${label}`)
    cleared++
  } catch (err) {
    console.log(`  ✗ ${label}: ${err.message}`)
  }
}

console.log(cleared === 0 ? '  Nothing to clear.\n' : `\nCleared ${cleared} item(s).\n`)
