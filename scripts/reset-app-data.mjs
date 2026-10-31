#!/usr/bin/env node

/**
 * Clears all Talyx Office app data for a fresh start (the AgroOps roster is seeded again).
 * Usage: npm run reset (or npm run dev:reset to reset and start the app)
 *
 * Deletes: office.db (+ -wal, -shm), settings.json, secrets/ (webhook keys, inbound token),
 * logos/.
 */

import { join } from 'path'
import { rmSync, existsSync } from 'fs'
import { homedir } from 'os'

// Talyx is macOS only; Electron's userData lives here.
const appData = join(homedir(), 'Library', 'Application Support', 'talyx')
console.log(`\n🧹 Clearing Talyx app data from: ${appData}\n`)

const targets = [
  { path: join(appData, 'office.db'), label: 'Database' },
  { path: join(appData, 'office.db-wal'), label: 'Database WAL' },
  { path: join(appData, 'office.db-shm'), label: 'Database SHM' },
  { path: join(appData, 'settings.json'), label: 'Settings' },
  { path: join(appData, 'secrets'), label: 'Secrets' },
  { path: join(appData, 'logos'), label: 'Logos' }
]

let cleared = 0
for (const { path, label } of targets) {
  if (existsSync(path)) {
    try {
      rmSync(path, { recursive: true })
      console.log(`  ✓ ${label}`)
      cleared++
    } catch (err) {
      console.log(`  ✗ ${label} — ${err.message}`)
    }
  }
}

if (cleared === 0) {
  console.log('  Nothing to clear — already clean.\n')
} else {
  console.log(`\n✅ Cleared ${cleared} item(s). App will start fresh.\n`)
}
